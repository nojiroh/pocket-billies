#!/usr/bin/env python3
"""Pictures of the models' decals (HB-1), for picture notes (nothing is judged here; software drawing can't judge a
look). A decal is a model's picture layer that stays put on it (`face: "fixed"`: a shop's lettering, the lab's window
view, washing on a line). Opens a test map with the game's own graphics, phone sized, and for every prop there whose
model has such a layer stands in front of it and takes four pictures: as placed, mirrored (`f`), turned 30 degrees
and with a size wobble of +25% (`vary.size`, worked out from the prop's own random draw). The decals should sit on the model in all four, and lettering read right
when mirrored (logic/prop-turn.js decalPlace). The numbers go to validation/look-decals/notes.json (not kept in git).

    python3 tools/look-decals.py                        # test_windows (the buildings), in validation/look-decals/
    python3 tools/look-decals.py --scene=test_props_next  # another test map (laundry lines, bunting, the giant tree)
    python3 tools/look-decals.py --only=shop,inn        # only these props
    python3 tools/look-decals.py --states=wobble        # only these of plain, mirrored, turned, wobble
    python3 tools/look-decals.py --out=DIR              # somewhere else (a "before" set from another worktree)

Uses the browser checks' page set-up (tools/browser_check.py: the clock, no accounts, the test globals), without the
low graphics."""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402
ARGS = sys.argv[1:]
ONLY = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--only=')), None)
OUT = Path(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), ROOT / 'validation' / 'look-decals'))
STATE_ONLY = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--states=')), None)
SCENE = next((a.split('=', 1)[1] for a in ARGS if a.startswith('--scene=')), 'test_windows')

# (name, what is changed on the placement)
STATES = [
    ('plain', {}),
    ('mirrored', {'f': 1}),
    ('turned', {'rot': 30}),
    ('wobble', {'vary': 'auto'}),
]

# the props whose model has a fixed picture layer (their recipes loaded first)
FIND = """(() => {
  const C = walkData().sc.props, out = [], seen = new Set();
  for (const p of walkView.sc.props || []) {
    const M = C[p.k];
    if (!M || typeof M.model !== 'string' || !/\\.json$/.test(M.model) || seen.has(p.k)) continue;
    const rec = loadPropModelRecipe(M.model);
    if (!rec || !(rec.layers || []).some(L => L.k === 'img' && L.face === 'fixed')) continue;
    seen.add(p.k);
    out.push({ k: p.k, i: walkView.sc.props.indexOf(p), x: p.x, z: p.z, rot: p.rot || 0 });
  }
  return out;
})()"""
HIDE_HUD = """(()=>{const cv=walkView.cv;for(const el of document.body.querySelectorAll('*'))
 if(el!==cv&&!el.contains(cv))el.style.setProperty('visibility','hidden','important');
 for(let e=cv;e;e=e.parentElement)e.style.setProperty('visibility','visible','important');return 0})()"""


def settle(pg, frames=8):
    f0 = pg.evaluate('walkRenderer.frames')
    if not CF.until(pg, f'walkRenderer.frames>={f0 + frames}', 240): raise Exception('stopped drawing')


def main():
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    srv, base = CF.serve(CF.GAME)
    errs, notes = [], {'scene': SCENE}
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        ctx, pg = CF.open_game(b, None, errs, low=False)
        ctx.set_default_timeout(240000)
        pg.set_viewport_size({'width': 390, 'height': 640})
        pg.goto(base + f'/index.html?test=1&scene={SCENE}')
        CF.drawing(pg)
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();environment.force={time:12.5,weather:'clear'};0")
        # no depth of field (it focuses on you, not the prop), as a player's own expert dials would set it
        pg.evaluate("(()=>{const p=saveData.preferences=saveData.preferences||{};p.expert=true;p.eng={lens:{blur:0,bokeh:0}};return 0})()")
        # the recipes come in by fetch: ask, then wait until the list stops growing
        got, last = [], -1
        for _ in range(20):
            got = pg.evaluate(FIND)
            if len(got) == last: break
            last = len(got)
            settle(pg, 3)
        pg.evaluate(HIDE_HUD)
        for s in got:
            if ONLY and s['k'] not in ONLY: continue
            for name, change in STATES:
                if STATE_ONLY and name not in STATE_ONLY: continue
                rot = s['rot'] + change.get('rot', 0)
                pg.evaluate(f"(()=>{{const p=walkView.sc.props[{s['i']}],c={json.dumps(change)};delete p.f;delete p.vary;Object.assign(p,c);p.rot={rot};walkRenderer.itemGen=(walkRenderer.itemGen||0)+1;return 0}})()")
                if change.get('vary') == 'auto':
                    # the wobble is the prop's own random draw (by where it stands) times vary.size and the variety
                    # dials: read the draw at vary.size 1, then scale it to +25% (a test map may have variety off)
                    s['size'] = pg.evaluate(f"(()=>{{const p=walkView.sc.props[{s['i']}],M=walkData().sc.props[p.k],sc=walkView.sc;sc.variety=sc.variety||1;const R=walkRenderer;p.vary={{size:1}};R.itemGen=(R.itemGen||0)+1;const d=propLook(p,M,sc).size-1;if(Math.abs(d)<0.02)return null;p.vary={{size:0.25/d}};R.itemGen++;return propLook(p,M,sc).size}})()")
                # a fixed camera 8 m in front of the prop as placed (its front: (sin r, -cos r)), 6.5 m up (over a hedge)
                pg.evaluate(f"(()=>{{const r={s['rot']}*Math.PI/180,f=[Math.sin(r),-Math.cos(r)],x={s['x']},z={s['z']},y=groundHeightAt(x,z);walkView.opt.look=()=>({{eye:[x+f[0]*8,y+6.5,z+f[1]*8],tgt:[x,y+2,z],fov:58}});return 0}})()")
                settle(pg)
                pg.screenshot(path=str(OUT / f"{s['k']}-{name}.png"))
                print(s['k'], name, flush=True)
            pg.evaluate(f"(()=>{{const p=walkView.sc.props[{s['i']}];delete p.f;delete p.vary;p.rot={s['rot']};walkRenderer.itemGen=(walkRenderer.itemGen||0)+1;return 0}})()")
            notes[s['k']] = s
        pg.evaluate('delete walkView.opt.look')
        ctx.close(); b.close()
    srv.shutdown()
    notes['errors'] = errs[:6]
    (OUT / 'notes.json').write_text(json.dumps(notes, indent=2))
    print(json.dumps({k: v for k, v in notes.items() if k != 'errors'}), 'errors:', notes['errors'])


if __name__ == '__main__':
    main()
