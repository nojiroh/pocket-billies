#!/usr/bin/env python3
"""Films of the battle's move animations (VFX-8, the VFX track's Part 2), so a change to how moves are played can be
checked frame by frame: nothing is judged by eye here.

Every move is played from both sides in 8 outcomes (hit, super x2, super x4, not very effective, crit, super crit,
miss, blocked) on the real battle stage of a wild battle in Copperleaf, with Math.random seeded per move and outcome
and the battle's quality locked at 0. The stage is stepped by hand at 16 ms a frame on a clock of its own (its frame
task taken off the page's loop; performance.now and setTimeout read that clock while a move plays), so the same code
gives the same film.

- trace.json: per move, side and outcome, what battleStagePlay returned ({dur, hit}) and the stage's state every
  third frame (the Billies' offsets, poses and flashes, every particle, the camera, shake, hit-stop, the flash, the
  impact frame, the pops). Two folders' traces are compared with --compare=DIR: the first difference of each film
  is printed, and the exit code is 1 when any differs.
- With --sheets (and --only=, since a drawn frame takes a second or two in software): a contact sheet per film of 16
  frames, 84 ms apart (two 24 fps cells), the GL scene stepped on the same clock.

    python3 tools/look-battle-anims.py                       # traces of all moves, validation/look-battle-anims/
    python3 tools/look-battle-anims.py --out=DIR             # somewhere else (e.g. a film before a change)
    python3 tools/look-battle-anims.py --only=tackle,zip     # move ids, or H / S / X (a category)
    python3 tools/look-battle-anims.py --only=zip --sheets   # with contact sheets
    python3 tools/look-battle-anims.py --compare=DIR         # this folder's trace against DIR's

Uses the browser checks' page set-up (tools/browser_check.py)."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402

ARGS = sys.argv[1:]
OPT = {a.split('=', 1)[0][2:]: (a.split('=', 1)[1] if '=' in a else True) for a in ARGS if a.startswith('--')}
OUT = Path(OPT.get('out') or ROOT / 'validation' / 'look-battle-anims')
ONLY = [s for s in str(OPT.get('only') or '').split(',') if s]
OUTCOMES = ['hit', 'se', 'x4', 'nve', 'crit', 'secrit', 'miss', 'blocked']
FRAMES, EVERY = 96, 3

# Math.random seeded from the start (util.js keeps the Math.random it finds when it loads), reseeded per film
SEEDED = """(()=>{let s=1;window.__seed=n=>{s=(n>>>0)%2147483646+1};Math.random=()=>{s=s*16807%2147483647;return (s-1)/2147483646}})()"""
# a third of the resolution (as the quick check draws), the game's own look otherwise
RENDER = """(()=>{let G;Object.defineProperty(window,'GAMEDATA',{configurable:true,get(){return G},set(v){if(v&&typeof v==='object'){
 v.engine=v.engine||{};v.engine.defaults=Object.assign({},v.engine.defaults||{},{quality:{resolution:.34,shadowMap:1024,auto:false}})}G=v}})})()"""
READY = "typeof walkView!=='undefined'&&walkView.ready&&!!saveData.started&&!document.getElementById('loader')"

# the film's machinery, put on the page once: the stage's frame task taken off the loop, a clock of its own
SETUP = r"""(()=>{
const S=battleStage,T=frameScheduler.tasks;
window.__film={tasks:new Map(T)};
T.clear();S.lockQ=true;S.q.lvl=0;
const r3=v=>Math.round((+v||0)*1000)/1000;
__film.hash=k=>{let h=2166136261;for(let i=0;i<k.length;i++){h^=k.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
__film.reset=()=>{S.tws.length=0;S.evs.length=0;S.parts.length=0;S.impact=null;S.shk=0;S.hold=0;S.coin=null;S.ring=null;S.calm=false;S.t=1e5;
 S.leafy.length=0;S.glint.length=0;
 S.s.forEach(s=>{Object.assign(s,{ox:0,oy:0,sc:1,a:1,white:0,dark:0,act:null,blinkUntil:0,lunge:null,trail:null,seed:1})});
 const home={x:0,y:1.6,z:0,yaw:0,hz:0};Object.assign(S.cam,home);Object.assign(S.V,home);Object.assign(S.drift,{w:0,tq:-1,x:0,y:0,z:0,yaw:0,hz:0});
 S.hand.a=0;S.css.r=0;S.css.z=0;S.camT=0;S.focusK=null;battleStageFocus('wide',true);
 const p=document.getElementById('pops');if(p)p.innerHTML='';const f=document.getElementById('flash');if(f){f.style.transition='none';f.style.opacity=0;f.style.background=''}
 const w=document.getElementById('camWorld');if(w)w.classList.remove('ca')};
__film.snap=(t0,vt)=>{const f=document.getElementById('flash'),w=document.getElementById('camWorld'),p=document.getElementById('pops');
 return JSON.stringify([Math.round(S.t-t0),S.s.map(s=>[r3(s.ox),r3(s.oy),s.act&&s.act.k,Math.round(s.blinkUntil>t0?s.blinkUntil-t0:0),r3(s.white),r3(s.a),r3(s.sc),s.lunge?1:0,s.trail?s.trail.list.length:0]),
  S.parts.map(q=>[q.spr||q.col||'',q.ring?1:0,q.beam?1:0,r3(q.x),r3(q.y),r3(q.z),Math.round(q.age),Math.round(q.life)]),
  ['x','y','z','yaw','hz'].map(k=>r3(S.cam[k])),r3(S.css.r),r3(S.css.z),r3(S.shk),S.hold>vt?1:0,r3(S.hand.a),r3(S.dof.zf),r3(S.dof.ap),S.focusK,
  f?[f.style.opacity,f.style.background]:0,w&&w.classList.contains('ca')?1:0,S.impact?1:0,
  p?[...p.children].map(e=>e.className+':'+e.textContent).join('|'):''])};
/* an outcome's move event, as the Studio's battle preview builds it */
__film.an=(mid,si,res)=>{const M=MOVES[mid],fx=M.fx||{},onFoe=M.c!=='X'||fx.status||fx.tgtStage||fx.hype||fx.spin||fx.wipe||fx.copyTypes,an={k:'move',si,ti:1-si,mid};
 if(fx.protect)an.protect=true;else if(!onFoe)an.self=true;else if(res==='miss')an.miss=true;else if(res==='blocked')an.blocked=true;
 else if(M.c!=='X'){an.dmg={crit:48,se:56,x4:80,nve:11,hit:24,secrit:70}[res];an.te={se:2,x4:4,nve:.5,secrit:2}[res]||1;an.crit=res==='crit'||res==='secrit'}
 return an};
/* plays one film on the film's clock: frames of 16 ms; every k-th frame's state (sheet: the GL tasks too, and
   resolves after each block of k frames so a picture can be taken) */
__film.play=(key,mid,si,res,frames,every)=>{const ev={s:activeBattle.events[activeBattle.events.length-1].s},pn=performance.now,st=window.setTimeout,timers=[];
 let vt=pn.call(performance)+1e7;performance.now=()=>vt;window.setTimeout=(fn,ms)=>{timers.push({t:vt+(+ms||0),fn});return 0};
 const out={key};try{__film.reset();__seed(__film.hash(key));const t0=S.t,F=__film.tasks.get('scene').fn;
  out.r=battleStagePlay(__film.an(mid,si,res),ev);out.trace=[];
  for(let i=0;i<frames;i++){vt+=16;timers.sort((a,b)=>a.t-b.t);while(timers.length&&timers[0].t<=vt)timers.shift().fn();F(vt,16);if(i%every===0)out.trace.push(__film.snap(t0,vt))}
 }catch(e){out.err=String(e&&e.stack||e)}finally{performance.now=pn;window.setTimeout=st}return out};
/* a sheet's film: the same, the walk renderer's frame task stepped with the stage's, a picture after every block */
__film.start=(key,mid,si,res)=>{__film.reset();__seed(__film.hash(key));__film.vt=performance.now()+1e7;__film.timers=[];__film.k=key;
 const ev={s:activeBattle.events[activeBattle.events.length-1].s};return __film.wrap(()=>battleStagePlay(__film.an(mid,si,res),ev))};
__film.wrap=fn=>{const pn=performance.now,st=window.setTimeout;performance.now=()=>__film.vt;window.setTimeout=(f,ms)=>{__film.timers.push({t:__film.vt+(+ms||0),fn:f});return 0};try{return fn()}finally{performance.now=pn;window.setTimeout=st}};
__film.step=n=>__film.wrap(()=>{for(let i=0;i<n;i++){__film.vt+=16;const T=__film.timers;T.sort((a,b)=>a.t-b.t);while(T.length&&T[0].t<=__film.vt)T.shift().fn();for(const [,t] of __film.tasks)t.fn(__film.vt,16)}return 0});
return 0})()"""


def pick(moves):
    if not ONLY: return moves
    return [m for m in moves if m['id'] in ONLY or m['c'] in ONLY]


def sheet(pg, key, mid, si, res):
    from PIL import Image, ImageDraw
    pg.evaluate(f"__film.start({json.dumps(key)},{json.dumps(mid)},{si},{json.dumps(res)})")
    shots = []
    for i in range(16):
        pg.evaluate('__film.step(5)' if i else '__film.step(1)')
        pg.wait_for_timeout(30)
        p = OUT / '_frame.png'
        pg.screenshot(path=str(p))
        shots.append(Image.open(p).convert('RGB'))
    w, h = shots[0].size
    W = Image.new('RGB', (w * 4, h * 4), 'black')
    d = ImageDraw.Draw(W)
    for i, im in enumerate(shots):
        x, y = (i % 4) * w, (i // 4) * h
        W.paste(im, (x, y))
        d.text((x + 4, y + 4), f'{key} {16 + 80 * (i - 1) if i else 16} ms', fill='white')
    W.save(OUT / f'{key}.png')
    (OUT / '_frame.png').unlink()


def compare(a, b):
    A = json.loads((a / 'trace.json').read_text())
    B = json.loads((b / 'trace.json').read_text())
    bad = 0
    for k in sorted(set(A) | set(B)):
        x, y = A.get(k), B.get(k)
        if x == y: continue
        bad += 1
        if not x or not y:
            print(k, 'only in', a if x else b)
            continue
        if x.get('r') != y.get('r'):
            print(k, 'returns', x.get('r'), 'vs', y.get('r'))
            continue
        for i, (p, q) in enumerate(zip(x.get('trace', []), y.get('trace', []))):
            if p != q:
                print(k, f'frame {i * EVERY}:', '\n  ', p[:400], '\n  ', q[:400])
                break
        else:
            print(k, 'differs', x.get('err') or y.get('err') or '(length)')
    print(f'{len(set(A) | set(B))} films, {bad} differ')
    return bad


def main():
    if 'compare' in OPT:
        sys.exit(1 if compare(OUT, Path(OPT['compare'])) else 0)
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    srv, base = CF.serve(CF.GAME)
    errs = []
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        ctx, pg = CF.new_page(b, errs, width=480, height=320, low=False, timeout=300000, init=(RENDER, SEEDED))
        pg.goto(base + '/index.html?fixture=town')
        if not CF.until(pg, READY, 300): raise Exception('the town fixture never got ready')
        pg.evaluate("uiState.toastQ=[];uiState.modal=null;uiState.mq=[];saveData.team.forEach(m=>{m.hp=maxHp(m);m.status=null});"
                    "const q={id:'film',sp:Object.keys(SPECIES).find(k=>SPECIES[k].stage===0),lvl:20,no:1};encountersHere().splice(0,1e9,q);startWild(q);0")
        if not CF.until(pg, "activeBattle&&activeBattle.phase==='choose'", 120, "activeBattle&&activeBattle.phase==='playing'&&tapMessage()"):
            raise Exception('the battle never reached the move menu')
        CF.until(pg, 'battleStage.gl', 30)
        pg.wait_for_timeout(1500)
        pg.evaluate(SETUP)
        moves = pick(pg.evaluate("Object.keys(MOVES).map(id=>({id,c:MOVES[id].c}))"))
        traces = {}
        for m in moves:
            for si in (0, 1):
                for res in OUTCOMES:
                    key = f"{m['id']}.{si}.{res}"
                    if 'sheets' in OPT:
                        sheet(pg, key, m['id'], si, res)
                        continue
                    r = pg.evaluate(f"__film.play({json.dumps(key)},{json.dumps(m['id'])},{si},{json.dumps(res)},{FRAMES},{EVERY})")
                    traces[key] = r
                    if r.get('err'): print(key, r['err'][:300], flush=True)
            print(m['id'], 'filmed', flush=True)
        if traces: (OUT / 'trace.json').write_text(json.dumps(traces, indent=0, sort_keys=True))
        ctx.close(); b.close()
    srv.shutdown()
    print(len(moves), 'moves;', 'errors:', [e for e in errs if 'gamedata.js' not in e][:6])


if __name__ == '__main__':
    main()
