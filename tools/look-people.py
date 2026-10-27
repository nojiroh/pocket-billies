#!/usr/bin/env python3
"""Characters track CH-1: people side by side (the test map test_people), in pictures and in draw calls, headless.

    python3 tools/look-people.py                    # every zoom stop, by day and at night, the camera turned 0, 35, 90 degrees
    python3 tools/look-people.py --crowd=40         # with 40 townsfolk wandering round the lineup as well
    python3 tools/look-people.py --only=normal,day  # only these zoom stops (close, normal, far), times (day, dusk, night)
                                                    # or turns (yaw0, yaw35, yaw90); kinds left out are all taken
    python3 tools/look-people.py --frames=12        # frames counted a shot (default 6)
    python3 tools/look-people.py --out=DIR          # somewhere else (a "before" set from another worktree)
    python3 tools/look-people.py --scene=test_props # another test map
    python3 tools/look-people.py --figures          # CH-2: Engine > People > Figures on (you and the lineup's figures
                                                    # baked); with --density=N (16-64), --steps=8|16|32, --outline=0,
                                                    # --figure=rogue|mannequin (yours), --style=pixel|smooth, --folk=1
    python3 tools/look-people.py --figures --lose   # then a forced loss of the game's context and of the figure baker's,
                                                    # a shot after each (the figures must come back)
    python3 tools/look-people.py --sheet[=mannequin|rogue] # a figure's every turn and frame baked as the game does, on
                                                    # one sheet at 4 screen pixels a pixel (figure-sheet-*.png), no shots;
                                                    # with --density (a list: 16,32,48 gives a sheet each), --steps,
                                                    # --outline, --style and --tilt=DEGREES (26: Normal)
    python3 tools/look-people.py --figures --battle # CH-3: a trainer battle once its moves are asked for, you (and with
                                                    # --folk=1 the rival) as figures at 64 px a metre (battle-*.png)

The page is a 390 x 844 phone at 3 device pixels to the CSS pixel (the one the characters track's numbers are worked
out for: the scene drawn into the same 860 x 1861 buffer as on the phone), with the game's own graphics, but auto
quality off (every pass every frame, as a phone with room to spare draws them), no depth of field (it would blur
everyone but you) and no see-through circle round you (it would thin out the people in front of you). You stand at
the map's hub, in the middle of the lineup; the camera is the game's own at each zoom stop (logic/camera-zoom.js
zoomStops), turned by hand as a player turns it. Everyone's walk frames are drawn before the first shot.

For each shot: the picture, and over --frames frames (engine/gpu-counters.js, as the debug log counts them) the draws
of each pass and how many of them drew people (the `person` tag), the people drawn, their pictures on the graphics
card and their MB (walk-view-gl.js peopleReport), the quality step, and how many scene-buffer pixels one art pixel of
yours covers (CH-0: 0.74 at the Normal stop). Headless Chromium draws in software, so its milliseconds mean nothing
(docs/graphics-bench.md): only counts are kept. Pictures and notes.json go to validation/look-people/ (not in git).
Run `npm run data` first. Nothing is sent anywhere."""
import json, math, sys, time
from importlib import import_module
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import browser_check as fast  # noqa: E402  (the browser checks' page set-up)
shots = import_module('island-shots')  # its HIDE_HUD and settle

ROOT = fast.ROOT
ARGS = sys.argv[1:]
arg = lambda k, d=None: next((a.split('=', 1)[1] for a in ARGS if a.startswith(f'--{k}=')), d)
SCENE = arg('scene', 'test_people')
OUT = Path(arg('out', ROOT / 'validation' / 'look-people'))
FRAMES = int(arg('frames', 6))
CROWD = int(arg('crowd', 0))
ONLY = set(arg('only', '').split(',')) - {''}
FIGURES = '--figures' in ARGS
LOSE = '--lose' in ARGS
BATTLE = '--battle' in ARGS
SHEET = next((a.split('=', 1)[1] if '=' in a else 'mannequin' for a in ARGS if a.startswith('--sheet')), None)
TILT = float(arg('tilt', 26))
FIG_DIALS = {k: v for k, v in (('density', arg('density')), ('yawSteps', arg('steps')), ('outline', arg('outline')),
                               ('figure', arg('figure')), ('style', arg('style')), ('folk', arg('folk'))) if v is not None}
TIMES = [('day', 12.5), ('dusk', 18.6), ('night', 22.0)]
YAWS = [0, 35, 90]
W, H, DPR = 390, 844, 3

# the counts of the frames that follow (engine/gpu-counters.js): every pass's draws, the people's among them, and the
# people's own report; no times
COUNT = """(async (n)=>{
 const R=walkRenderer, f0=R.frames;
 gpuCountBegin();
 await new Promise(ok=>{const tick=()=>{if(R.frames-f0>=n)ok();else requestAnimationFrame(tick)};requestAnimationFrame(tick)});
 const g=gpuCountEnd(), ppl={};
 for (const p in (g&&g.dct)||{}) if (g.dct[p].person) ppl[p]=g.dct[p].person;
 const rep=typeof peopleReport==='function'?peopleReport():null;
 return {frames:g&&g.frames, draws:g&&g.dc[0], instances:g&&g.dc[1], passes:g&&g.dcp, people:ppl,
  peopleDraws:Object.values(ppl).reduce((a,b)=>a+b,0), drawn:rep&&rep.drawn, pictures:rep&&rep.textures,
  mb:rep&&rep.mb, q:R.qe||0, lights:R.X&&R.X.lights?R.X.lights.length:0}})"""

# every walk frame of everyone in the lineup and you drawn now (person-art.js draws them a few a frame otherwise, which
# at a headless frame every few seconds takes minutes); false while some art is still loading (person-art.js keeps
# nothing drawn without it), so it is asked again
WARM = """(()=>{const who=[...new Set(['me',...(walkView.sc.lineup||[]).map(L=>L.who).filter(w=>typeof w==='string')])];personArtMissing=false;
 for(const w of who){const F=personWalkFrames(w);if(!F)continue;
  for(const d of ['down','up','side','sideR']){const v=F[d];if(!v)continue;v[0];for(let i=0;i<6;i++)if(v.cyc)v.cyc[i]}}
 return !personArtMissing})()"""

# how many scene-buffer pixels tall one of your art pixels is: you, 1.75 m upright, projected by this frame's camera
DENSITY = """(()=>{const C=walkView.C,P=walkView.pl;if(!C||!C.vp||!P)return null;
 const y=P.yv??standingHeightAt(P.x,P.z),ppm=(typeof figuresOn==='function'&&figuresOn()?engineSetting('people','density'):0)||(wardrobeData()||{}).ppm||66.5,
  sy=v=>{const m=C.vp,w=m[3]*v[0]+m[7]*v[1]+m[11]*v[2]+m[15],yc=m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13];return (1-yc/w)/2*C.rh};
 const px=Math.abs(sy([P.x,y,P.z])-sy([P.x,y+1.75,P.z]));
 return {buffer:[C.rw,C.rh],personPx:Math.round(px*10)/10,perArtPx:Math.round(px/(1.75*ppm)*100)/100}})()"""


def wanted(*names):
    """a shot is taken unless --only names something of its kind and not this one"""
    kinds = [{'close', 'normal', 'far'}, {'day', 'dusk', 'night'}, {f'yaw{y}' for y in YAWS}]
    return all(not (ONLY & k) or n in ONLY for n, k in zip(names, kinds))


# CH-2: one figure's pictures as the baker makes them (figures.js bakeFigure): every turn of the dial's steps (rows),
# the idle's first pose and its blink, then the walk's 8 frames (columns); each as a PNG
SHEET_JS = """((name, tilt, dials) => {const Fig=figureDef(name); if(!Fig) return Fig===null?'loading':null;
 const ppm=dials.style==='smooth'?128:(dials.density||32), steps=dials.yawSteps||16, outline=dials.outline!==false, rows=[];
 const cols = Fig.kind==='code' ? [['idle',0],['idle',14],...[0,1,2,3,4,5,6,7].map(i=>['walk',i])]
  : [['idle',0], ...[0,1,2,3,4,5,6,7].map(i=>['walk',Math.floor(i*Fig.clips.walk.frames/8)]),
     ...['run','cheer','throw','sit'].filter(c=>Fig.clips[c]).map(c=>[c,Math.floor(Fig.clips[c].frames/3)])];
 for (let k=0;k<steps;k++){const V=figureView((k*2*Math.PI)/steps,0,tilt*Math.PI/180,steps), row=[];
  for (const [clip,f] of cols){
   const im=bakeFigure(Fig,clip,f,V,ppm,outline,dials.style||'pixel'); if(!im) return 'loading'; row.push(im.toDataURL('image/png'))}
  rows.push(row)}
 return {rows, ppm, steps, report: figureReport()}})"""


def dial_values():
    """the People dials given (--density, --steps, --outline, --figure, --style, --folk) as the engine's values"""
    out = {}
    for k, v in FIG_DIALS.items():
        if k in ('outline', 'folk'): out[k] = v != '0'
        elif k in ('figure', 'style'): out[k] = v
        else: out[k] = int(v.split(',')[0])
    return out


def sheet(pg, t0, density=None):
    """the --sheet contact sheet: the figure's views baked in the page, laid out and enlarged here"""
    import base64, io
    from PIL import Image
    dials = dial_values()
    if density: dials['density'] = density
    for _ in range(60):
        r = pg.evaluate(f'{SHEET_JS}({json.dumps(SHEET)},{TILT},{json.dumps(dials)})')
        if r != 'loading': break
        pg.wait_for_timeout(500)
    if not r or r == 'loading': raise Exception(f'no figure {SHEET}')
    ims = [[Image.open(io.BytesIO(base64.b64decode(u.split(',', 1)[1]))) if u else None for u in row] for row in r['rows']]
    cw = max(i.width for row in ims for i in row if i) + 2
    ch = max(i.height for row in ims for i in row if i) + 2
    S = 4
    out = Image.new('RGBA', (cw * len(ims[0]) * S, ch * len(ims) * S), (196, 214, 170, 255))
    for y, row in enumerate(ims):
        for x, i in enumerate(row):
            if i: out.alpha_composite(i.resize((i.width * S, i.height * S), Image.NEAREST), (x * cw * S, y * ch * S))
    name = f"figure-sheet-{SHEET}-{r['ppm']}ppm-{r['steps']}turns-{int(TILT)}deg{'' if dials.get('outline', True) else '-nooutline'}{'-smooth' if dials.get('style') == 'smooth' else ''}.png"
    out.save(OUT / name)
    print(f"[{time.time() - t0:5.0f}s] {name}: {len(ims)} turns by {len(ims[0])} poses, the baker {r['report']}", flush=True)
    return {'shot': name, 'figures': r['report']}


def battle(pg, t0):
    """CH-3: a trainer battle (as check-quick's battles start one), shot once its moves are asked for and the
    trainers' figures are baked: by day, then at dusk"""
    out = []
    pg.evaluate("environment.force={time:12.5,weather:'clear',season:'summer'};0")
    tid = pg.evaluate("Object.keys(TRAINERS).find(k=>TRAINERS[k].team&&TRAINERS[k].team.length>=1)||''")
    if not tid: return [{'shot': 'battle', 'error': 'no trainer'}]
    pg.evaluate(f"uiState.dbgSpeed=true;battleStage.speed=4;startTrainer('{tid}',{{talked:true}});0")
    tap = "activeBattle&&activeBattle.phase==='playing'&&tapMessage()"
    if not fast.until(pg, "activeBattle&&activeBattle.phase==='choose'", 240, tap):
        return [{'shot': 'battle', 'error': 'never reached the move menu'}]
    for tname, hour in (('day', 12.5), ('dusk', 18.6)):
        pg.evaluate(f"environment.force={{time:{hour},weather:'clear',season:'summer'}};0")
        shots.settle(pg, 8)
        name = f"battle-{tname}{'-figures' if FIGURES else ''}"
        pg.screenshot(path=str(OUT / f'{name}.png'))
        r = pg.evaluate(f'{COUNT}({FRAMES})')
        r.update(shot=name, trainer=tid, figures=pg.evaluate('figureReport()'),
                 frames=pg.evaluate("[0,1].map(i=>{const f=trainerBattleFrame(i);return f?[f.width,f.height,f.ppm||null,f.figure||null]:null})"))
        out.append(r)
        print(f"[{time.time() - t0:5.0f}s] {name:>24}: {r['draws']} draws, trainers {r['frames']}, figures {r['figures']}", flush=True)
    return out


def lose(pg, t0):
    """CH-2: the game's context lost and restored (engine/webgl.js forceContextLoss), then the figure baker's
    (figures.js figureBakerLose), a shot and the counts after each: everyone, the figures among them, drawn again"""
    out = []
    pg.evaluate("walkRenderer.zoomT=walkRenderer.zoom=1;walkRenderer.yawT=walkRenderer.yaw=0;walkRenderer.camT=null;environment.force={time:12.5,weather:'clear',season:'summer'};0")
    for what, js in (('game', 'forceContextLoss(1500)'), ('baker', 'figureBakerLose(1500)')):
        ok = pg.evaluate(f'(()=>{{try{{return {js}!==false}}catch(e){{return String(e)}}}})()')
        shots.settle(pg, 4)
        pg.wait_for_timeout(2500)
        shots.settle(pg, 6)
        name = f'figures-lost-{what}'
        pg.screenshot(path=str(OUT / f'{name}.png'))
        r = pg.evaluate(f'{COUNT}({FRAMES})')
        r.update(shot=name, lost=what, forced=ok, glLost=pg.evaluate('gpuState.lost||0'), figures=pg.evaluate('figureReport()'))
        out.append(r)
        print(f"[{time.time() - t0:5.0f}s] {name:>24}: forced {ok}, {r['drawn']} people drawn, {r['draws']} draws, "
              f"figures {r['figures']}", flush=True)
    return out


def main():
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    srv, base = fast.serve(fast.GAME)
    errs, rows = [], []
    t0 = time.time()
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=fast.LAUNCH)
        ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=DPR, is_mobile=True, has_touch=True)
        for s in (fast.CLOCK, fast.NO_ACCOUNTS, fast.TEST_GLOBALS): ctx.add_init_script(s)
        ctx.set_default_timeout(600000)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{base}/index.html?test=1&scene={SCENE}')
        if not fast.until(pg, f"typeof walkView!=='undefined'&&walkView.ready&&walkRenderer.on&&(walkView.sc.baseId||walkView.id)==='{SCENE}'", 300):
            raise Exception(f'{SCENE} never opened')
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();0")
        # the game's graphics, with auto quality and depth of field off, as a player's own expert dials set them, and no
        # see-through circle round you (the lineup in front of you would thin out)
        people = {'figures': True, **dial_values()} if FIGURES else {}
        pg.evaluate(f"(()=>{{const p=saveData.preferences=saveData.preferences||{{}};p.expert=true;p.eng={{quality:{{auto:false}},lens:{{blur:0,bokeh:0}},camera:{{hideFade:false}},people:{json.dumps(people)}}};return 0}})()")
        if CROWD: pg.evaluate(f"walkView.sc.folk={CROWD};walkView.folkId='';0")
        hub = pg.evaluate('mapHub(walkView.sc)')
        # you at the hub, the camera's target reset (browser_check.stand, with island-shots' longer wait: at three
        # device pixels to the CSS pixel a headless frame takes seconds)
        pg.evaluate(f"(()=>{{const P=walkView.pl;P.x={hub[0]};P.z={hub[1]};P.route=null;P.yv=null;walkRenderer.camT=null;return 0}})()")
        shots.settle(pg, 4)
        # you face the camera (a plain word: logic/person-view.js faceWord), as a fresh view stands you
        pg.evaluate("(()=>{const P=walkView.pl;if(typeof faceWord==='function')faceWord(P,'down');else P.dir='down';return 0})()")
        if SHEET:
            for d in (FIG_DIALS.get('density') or '32').split(','):
                rows.append(sheet(pg, t0, int(d)))
            ctx.close(); b.close(); srv.shutdown()
            (OUT / 'notes.json').write_text(json.dumps({'sheet': rows, 'errors': errs[:6]}, indent=1))
            print('errors:', errs[:6])
            return
        print(f'[{time.time() - t0:5.0f}s] {SCENE} open; drawing everyone\'s walk frames', flush=True)
        for _ in range(60):
            if pg.evaluate(WARM): break
            shots.settle(pg, 2)
        else: print('  some art never loaded: those people are drawn without it', flush=True)
        # a lineup entry that is a figure (CH-2: `figure`, no `who`) is drawn only with the figures on
        want = pg.evaluate(f"(walkView.sc.lineup||[]).filter(L=>typeof L.who==='string'||({'true' if FIGURES else 'false'}&&L.figure)).length") + 1 + CROWD
        if not fast.until(pg, f'peopleReport().drawn>={want}', 600):
            print(f"  only {pg.evaluate('peopleReport().drawn')} of {want} people drawn", flush=True)
        shots.settle(pg, 4)
        print(f'[{time.time() - t0:5.0f}s] {pg.evaluate("peopleReport().drawn")} people drawn; the shots', flush=True)
        pg.evaluate(shots.HIDE_HUD)
        stops = pg.evaluate('zoomStops().map(s=>[s.id,s.zoom])')
        for tname, hour in TIMES:
            pg.evaluate(f"environment.force={{time:{hour},weather:'clear',season:'summer'}};0")
            for sid, zoom in stops:
                for yaw in YAWS:
                    if not wanted(sid, tname, f'yaw{yaw}'): continue
                    pg.evaluate(f"walkRenderer.zoomT=walkRenderer.zoom={zoom};walkRenderer.yawT=walkRenderer.yaw={math.radians(yaw)};walkRenderer.camT=null;0")
                    shots.settle(pg, 6)
                    name = f"{'figures-' if FIGURES else ''}{'crowd%d-' % CROWD if CROWD else ''}{tname}-{sid}-yaw{yaw}"
                    pg.screenshot(path=str(OUT / f'{name}.png'))
                    r = pg.evaluate(f'{COUNT}({FRAMES})')
                    r.update(shot=name, time=tname, stop=sid, zoom=zoom, yaw=yaw, crowd=CROWD, **(pg.evaluate(DENSITY) or {}))
                    if FIGURES: r['figures'] = pg.evaluate('figureReport()')
                    rows.append(r)
                    print(f"[{time.time() - t0:5.0f}s] {name:>24}: {r['drawn']} people drawn, {r['draws']} draws "
                          f"({r['peopleDraws']} people's: {r['people']}), {r['pictures']} pictures {r['mb']} MB, "
                          f"q{r['q']}, {r.get('perArtPx')} buffer px an art px", flush=True)
        if LOSE: rows += lose(pg, t0)
        if BATTLE: rows += battle(pg, t0)
        pg.evaluate("environment.force=null;0")
        ctx.close(); b.close()
    srv.shutdown()
    notes = {'scene': SCENE, 'phone': [W, H, DPR], 'frames': FRAMES, 'crowd': CROWD, 'shots': rows, 'errors': errs[:6]}
    (OUT / 'notes.json').write_text(json.dumps(notes, indent=1))
    print(f'{len(rows)} shots in {OUT}', 'errors:', errs[:6])


if __name__ == '__main__':
    main()
