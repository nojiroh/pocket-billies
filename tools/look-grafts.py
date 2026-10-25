#!/usr/bin/env python3
"""Pictures of a grafted Billie (splicing track SP-1), for picture notes (nothing is judged here). Opens Copperleaf
(?fixture=town) phone sized, takes the team screen, the lead's details and the walk (the buddy following you) before
and after grafting the lead with another species' part (logic/graft-art.js graftSet; baked by skeleton-rig.js), then a
wild battle against a grafted Billie (your grafted lead from behind, the foe from the front). The bake times
(graftReport) go to validation/look-grafts/notes.json.

    python3 tools/look-grafts.py                       # in validation/look-grafts/
    python3 tools/look-grafts.py --graft=sig=zuck2     # this graft on the lead (default: its first front donor)
    python3 tools/look-grafts.py --out=DIR

Uses the browser checks' page set-up (tools/browser_check.py: the clock, no accounts, the test globals)."""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402
ARGS = sys.argv[1:]
OUT = Path(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), ROOT / 'validation' / 'look-grafts'))
GRAFT = next((a.split('=', 1)[1] for a in ARGS if a.startswith('--graft=')), '')
FOE = 'swift1'


def ui(pg):
    pg.evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
    CF.until(pg, "document.getAnimations().every(a=>a.playState!=='running'||!isFinite(a.effect.getComputedTiming().endTime))", 5)


def screens(pg, tag):
    for name, js in [
        ('team', "uiState.modal=null;uiState.mq=[];renderOverlay();uiState.tab='team';render();0"),
        ('details', "uiState.modal=null;uiState.mq=[];renderOverlay();billySheet(saveData.team[0]);0"),
        ('walk', "uiState.modal=null;uiState.mq=[];renderOverlay();uiState.tab='walk';render();0"),
    ]:
        pg.evaluate(js); ui(pg)
        if name == 'walk':
            f0 = pg.evaluate('walkRenderer.frames')
            CF.until(pg, f'walkRenderer.frames>={f0 + 20}', 120)
        else:  # the rig canvases draw on the animator's next frames
            CF.until(pg, "[...document.querySelectorAll('canvas.rig')].filter(c=>{const r=c.getBoundingClientRect();return r.width&&r.bottom>0&&r.top<innerHeight}).every(c=>c._drawn)", 30)
        pg.screenshot(path=str(OUT / f'{tag}-{name}.png'))


def main():
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    srv, base = CF.serve(CF.GAME)
    errs, notes = [], {}
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        ctx, pg = CF.open_game(b, None, errs)
        pg.set_viewport_size({'width': 540, 'height': 960})
        pg.goto(base + '/index.html?fixture=town')
        CF.drawing(pg)
        if not CF.until(pg, "!document.getElementById('loader')", 60): raise Exception('the loading screen never went')
        lead = pg.evaluate("saveData.team[0].sp")
        g = GRAFT or pg.evaluate(f"'front='+graftDonors(gameData.kitBuilds,gameData.partKits,{json.dumps(lead)},'front')[0]")
        gf = pg.evaluate(f"'front='+graftDonors(gameData.kitBuilds,gameData.partKits,'{FOE}','front')[0]")
        notes.update(lead=lead, graft=g, foe=FOE, foeGraft=gf)
        screens(pg, '1-before')
        pg.evaluate(f"graftSet(saveData.team[0],{json.dumps(g)});rigPreload([[saveData.team[0].sp,1,saveData.team[0].coat,{json.dumps(g)}],[saveData.team[0].sp,RIG_BACK_VIEW,saveData.team[0].coat,{json.dumps(g)}]])")
        screens(pg, '2-after')
        pg.evaluate(f"screenWipe=f=>f();const q={{id:'tgraft',sp:'{FOE}',lvl:8,no:1}};graftSet(q,{json.dumps(gf)});encountersHere().splice(0,1e9,q);saveData.team.forEach(m=>{{m.hp=maxHp(m)}});startWild(q);0")
        CF.until(pg, "activeBattle&&activeBattle.phase==='choose'", 120, "activeBattle&&activeBattle.phase==='playing'&&tapMessage()")
        f0 = pg.evaluate('typeof battleStage!=="undefined"?battleStage.t:0')
        CF.until(pg, f'battleStage.t>{f0}+800', 30)
        pg.screenshot(path=str(OUT / '3-battle.png'))
        # each side drawn from its grafted rig, not the species' own
        notes['battleSides'] = pg.evaluate("battleStage.s.map((s,i)=>s&&s.sp?{sp:s.sp,graft:s.graft||null,grafted:!!s.graft&&rigParts(s.sp,ACTOR_RIG_SCALES[i],s.coat,s.graft)!==rigParts(s.sp,ACTOR_RIG_SCALES[i],s.coat)}:null)")
        notes['report'] = pg.evaluate('graftReport()')
        ctx.close(); b.close()
    srv.shutdown()
    notes['errors'] = errs[:6]
    (OUT / 'notes.json').write_text(json.dumps(notes, indent=2))
    print(json.dumps(notes, indent=1))


if __name__ == '__main__':
    main()
