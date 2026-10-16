'use strict';
/* ================= BOOT =================
   Clear stale art if Pocket Billies Studio changed any (meta.artVersion), then load and check every piece of art the game
   uses (billionaires, battle stages, walk scenes, the world map, icons) behind the loading screen, so nothing pops in
   later and a missing file shows up right away. Then draw the game. */
const ART_VER_KEY='networth-artv';
async function artCacheCheck(){const v=String(GD.meta.artVersion||0);let old=null;try{old=localStorage.getItem(ART_VER_KEY)}catch(e){}
 if(old!==v){try{if(window.caches){const keys=await caches.keys();await Promise.all(keys.filter(k=>k.includes('-art')).map(k=>caches.delete(k)))}}catch(e){}try{localStorage.setItem(ART_VER_KEY,v)}catch(e){}}}
const idle=(fn,t=1200)=>('requestIdleCallback' in window?requestIdleCallback(fn,{timeout:t}):setTimeout(fn,200));
const UI_SVG=['profile','house','lock','flag','leaf','list','globe','back','bag','bolt','bug','chev','close','coin','fight','gauge','gear','heart','ledger','map','mint','minus','plus','run','shop','spark','team','walk','drop','fish','camera','boat','sun','moon','cloud','rain','snow','fog','ash','door'];
/* v26: the walk scenes follow the real clock, the weather and the season (env.js; the Studio leaves this off) */
if(typeof ENV!=='undefined')ENV.on=true;
const LOAD_PHASES=['Polishing the coins','Waking up the Billies','Building the battlefields','Planting trees and painting towns','Unrolling the world map'];
const LOAD_TIPS=['Every real step you walk moves you along the road, hatches eggs and brings Billies out of the tall grass.',
 'You don’t have to travel. Stay in a town and your steps still earn money and encounters.','Tap the ground to walk around. Tap a building to visit it.',
 'Clinics heal your whole team for free. Just walk up to the door.','A Billie hides in the grass with only its level showing. You find out who it is when the battle starts.',
 'Fire beats Grass, Grass beats Water, Water beats Fire. The classics never go out of style.','Flick a coin at a tired Billie to tax it.',
 'The world map shows every road. Pick a place, and your steps take you there.','Road signs at the edge of town tell you where each road goes.'];
/* every art file, grouped by loading phase */
function loadList(){const L=new Map(),add=(p,ph)=>{if(p&&!L.has(p))L.set(p,ph)};
 [ICON_ATLAS,...COIN_ART,...EGG_ART,...BG_ART].forEach(p=>add(p,0));
 for(const sp of Object.keys(SP)){const R=RIGS[sp];if(!R)continue;for(const v of ['front','back'])if(R[v])for(const g of [0,1])add(rigAtlas(sp,g,v),1)}
 for(const a of Object.keys(AREAS)){try{stageArt(a).forEach(p=>add(p,2))}catch(e){}}
 try{const D=dioData();for(const id of Object.keys(D.scenes))dioPaths(D.scenes[id]).forEach(p=>add(p,3));for(const P of Object.values(D.sc.props)){add(P.img,3);if(P.blades)add(P.blades.img,3);for(const h of P.hands||[])add(h.img,3)}for(const T of Object.values(D.sc.terrains))add(T.tile,3)}catch(e){console.error(e)}
 add(WORLD_ART,4);if(typeof WORLD_RELIEF!=='undefined')add(WORLD_RELIEF,1);try{trainerArtPaths().forEach(p=>add(p,0))}catch(e){console.error(e)}return L}
const LD={el:null,tipI:0,tipT:null,shown:0,f:0};
function loaderSet(done,total,phase){const el=LD.el;if(!el)return;const f=total?done/total:0,pct=Math.round(f*100);LD.f=Math.max(LD.f,f);
 const bar=el.querySelector('.ld-bar i');if(bar)bar.style.width=pct+'%';if(LD.town){const cv=document.getElementById('dio');if(cv)cv.style.clipPath=`circle(${Math.round(14+LD.f*110)}% at 50% 56%)`}el.setAttribute('aria-valuenow',pct);
 el.querySelector('.ld-count').textContent=`${pct}%`;if(phase!=null)el.querySelector('.ld-phase').textContent=LOAD_PHASES[phase]||phase}
/* ---------- alpha 0.4.1: the island that builds itself while the game loads ----------
   Drawn by hand on a 256 x 168 canvas (no art is loaded yet): isometric ground tiles drop in from the middle outward
   as the files come in, then trees, little houses, lamps and an airship station whose ship bobs at its mast. Each
   thing waits for its share of the loading; when the load is done the whole island is there. */
const LDW={cv:null,x:null,tiles:[],things:[],raf:0,last:0};
function ldwRnd(i,k){const v=Math.sin(i*127.1+k*311.7)*43758.5453;return v-Math.floor(v)}
function ldwInit(){const cv=LD.el&&LD.el.querySelector('.ld-world');if(!cv||!cv.getContext)return;LDW.cv=cv;LDW.x=cv.getContext('2d');
 const T=[];for(let i=-6;i<=6;i++)for(let j=-6;j<=6;j++){const d=Math.hypot(i,j*1.05);if(d>6.2+ldwRnd(i+20,j+20)*.9)continue;T.push({i,j,d,o:d+ldwRnd(i,j)*1.6})}
 T.sort((a,b)=>a.o-b.o);const n=T.length,maxD=Math.max(...T.map(t=>t.d));T.forEach((t,k)=>{t.need=.04+.56*k/n;t.edge=t.d>maxD-1.3;t.road=(t.i===0||t.j===1)&&!t.edge;t.at=0;t.h=t.edge?2:3+Math.round(ldwRnd(t.i,t.j+7)*1.2)});LDW.tiles=T;
 /* things on the island: what, which tile, when it may come */
 const free=T.filter(t=>!t.edge&&!t.road),pick=(k)=>free.splice(Math.floor(ldwRnd(k,3)*free.length)%Math.max(1,free.length),1)[0],TH=[];
 const st=T.find(t=>t.i===2&&t.j===-2)||free[0];if(st&&free.includes(st))free.splice(free.indexOf(st),1);
 for(let k=0;k<4;k++){const t=pick(k+40);if(t)TH.push({k:'house',t,need:.5+k*.08,c:k%3})}
 for(let k=0;k<11;k++){const t=pick(k+1);if(t)TH.push({k:'tree',t,need:.3+k*.045,c:k%3})}
 for(let k=0;k<3;k++){const t=pick(k+80);if(t)TH.push({k:'lamp',t,need:.72+k*.05})}
 if(st){TH.push({k:'mast',t:st,need:.82});TH.push({k:'ship',t:st,need:.9})}
 TH.forEach(o=>o.at=0);LDW.things=TH;LDW.t0=performance.now();ldwLoop()}
const LDW_C={grass:['#7cc35a','#5a9a47','#467a3a'],sand:['#ead48f','#c9ae68','#a98d52'],road:['#d8b98a','#b8956a','#97764f']};
function ldwLoop(){LDW.raf=requestAnimationFrame(ldwLoop);const now=performance.now();if(now-LDW.last<32)return;LDW.last=now;try{ldwDraw(now)}catch(e){cancelAnimationFrame(LDW.raf)}}
function ldwDraw(now){const x=LDW.x,W=256,H=168,f=LD.f,cx=128,cy=74,TW=10,TH2=5;x.clearRect(0,0,W,H);
 const ease=k=>k<=0?0:k>=1?1:1-Math.pow(1-k,3),back=k=>{if(k<=0)return 0;if(k>=1)return 1;const c=1.9;return 1+(c+1)*Math.pow(k-1,3)+c*Math.pow(k-1,2)};
 /* the sea under the island: a soft ellipse with glints */
 const sea=ease((now-LDW.t0)/900);x.globalAlpha=.55*sea;x.fillStyle='#3d7fa6';x.beginPath();x.ellipse(cx,cy+16,92*sea,40*sea,0,0,7);x.fill();x.globalAlpha=.35*sea;x.fillStyle='#8fd0e8';
 for(let g=0;g<14;g++){const a=g*.45+now/2400,r=60+20*ldwRnd(g,1);x.fillRect(Math.round(cx+Math.cos(a)*r*1.3),Math.round(cy+16+Math.sin(a)*r*.42),3,1)}x.globalAlpha=1;
 const P=(i,j)=>[cx+(i-j)*TW,cy+(i+j)*TH2];
 const L=[];for(const t of LDW.tiles){if(f>=t.need&&!t.at)t.at=now;if(t.at)L.push(t)}L.sort((a,b)=>(a.i+a.j)-(b.i+b.j));
 for(const t of L){const k=ease((now-t.at)/420),drop=(1-k)*-34,[px,py]=P(t.i,t.j),y=py+drop,C=t.edge?LDW_C.sand:t.road?LDW_C.road:LDW_C.grass,h=t.h;x.globalAlpha=Math.min(1,k*2);
  x.fillStyle=C[1];x.beginPath();x.moveTo(px-TW,y);x.lineTo(px,y+TH2);x.lineTo(px,y+TH2+h);x.lineTo(px-TW,y+h);x.fill();
  x.fillStyle=C[2];x.beginPath();x.moveTo(px+TW,y);x.lineTo(px,y+TH2);x.lineTo(px,y+TH2+h);x.lineTo(px+TW,y+h);x.fill();
  x.fillStyle=C[0];x.beginPath();x.moveTo(px,y-TH2);x.lineTo(px+TW,y);x.lineTo(px,y+TH2);x.lineTo(px-TW,y);x.fill();
  if(!t.edge&&!t.road&&ldwRnd(t.i,t.j+3)<.5){x.fillStyle='#9bd86a';x.fillRect(Math.round(px-3+ldwRnd(t.i,t.j)*6),Math.round(y-1),2,1)}
  if(!t.edge&&!t.road&&ldwRnd(t.i+9,t.j)<.18){x.fillStyle=['#ff8fa6','#ffe066','#ffffff'][Math.floor(ldwRnd(t.i,t.j+5)*3)];x.fillRect(Math.round(px+2-ldwRnd(t.j,t.i)*5),Math.round(y),1,1)}}
 x.globalAlpha=1;
 /* things, back to front, each springing up once its tile has landed */
 const O=[];for(const o of LDW.things){if(f>=o.need&&o.t.at&&now-o.t.at>300&&!o.at)o.at=now;if(o.at)O.push(o)}O.sort((a,b)=>(a.t.i+a.t.j)-(b.t.i+b.t.j)||(a.k==='ship')-(b.k==='ship'));
 for(const o of O){const k=back((now-o.at)/520),[px,py]=P(o.t.i,o.t.j);x.save();x.translate(px,py);x.scale(1,Math.max(.01,k));ldwThing(x,o,now);x.restore()}}
function ldwThing(x,o,now){const R=(a,b,w,h,c)=>{x.fillStyle=c;x.fillRect(a,b,w,h)};
 if(o.k==='tree'){const G=[['#4f9a3f','#3b7a32','#6cbc52'],['#5aa64a','#41823a','#7fcf62'],['#6f9e3a','#557c2e','#93c255']][o.c];R(-1,-7,2,8,'#7a4a2c');
  x.fillStyle=G[1];x.beginPath();x.arc(0,-11,6,0,7);x.fill();x.fillStyle=G[0];x.beginPath();x.arc(-1,-12,5,0,7);x.fill();x.fillStyle=G[2];x.fillRect(-3,-15,3,2);return}
 if(o.k==='house'){const wall=['#f1e3c6','#e9d2b0','#dfe7ee'][o.c],roof=['#c8553d','#4f7fb8','#7a9a3c'][o.c];
  R(-8,-9,9,9,wall);R(1,-9,7,9,'#c9b48f');R(-6,-6,2,2,'#ffe28a');R(-2,-4,2,4,'#7a4a2c');R(3,-6,2,2,'#8fc6e6');
  x.fillStyle=roof;x.beginPath();x.moveTo(-10,-8);x.lineTo(-1,-16);x.lineTo(1,-16);x.lineTo(10,-8);x.fill();x.fillStyle='rgba(0,0,0,.18)';x.beginPath();x.moveTo(1,-16);x.lineTo(10,-8);x.lineTo(1,-8);x.fill();return}
 if(o.k==='lamp'){R(0,-10,1,10,'#3a3348');const g=.6+.4*Math.sin(now/300+o.t.i);x.fillStyle=`rgba(255,220,130,${.35*g})`;x.beginPath();x.arc(.5,-11,4,0,7);x.fill();R(-1,-12,3,2,'#ffe7a0');return}
 if(o.k==='mast'){R(-1,-34,2,34,'#3d4a56');for(let y=-32;y<0;y+=4){R(-3,y,6,1,'#56657a')}R(-6,-2,12,2,'#b0a089');R(-3,-36,6,2,'#c9a548');return}
 if(o.k==='ship'){const b=Math.sin(now/650)*1.5,sw=Math.sin(now/900)*1;x.translate(sw,b);
  x.fillStyle='#d9824a';x.beginPath();x.ellipse(-12,-40,15,6,0,0,7);x.fill();x.fillStyle='#f4e6cf';for(const dx of [-20,-12,-4])x.fillRect(Math.round(dx),-46,3,12);
  x.fillStyle='rgba(0,0,0,.15)';x.beginPath();x.ellipse(-12,-37,15,3,0,0,Math.PI);x.fill();R(-17,-33,10,3,'#8a5a36');R(-25,-41,3,3,'#c96a3a');
  const sp=now/60;R(-28,-41+Math.round(Math.sin(sp)*2),1,3,'#e8e2d4');return}}
/* v47: lines from the world (lore.loading: lore, tips and jokes) between the tips, a new one every few seconds */
function loaderLines(){if(!LD.lines){const W=typeof loreLoadingLines==='function'?loreLoadingLines():[],T=LOAD_TIPS.slice();LD.lines=[];while(W.length||T.length){if(W.length)LD.lines.push(W.shift());if(W.length)LD.lines.push(W.shift());if(T.length)LD.lines.push(T.shift())}}return LD.lines}
function loaderTip(){const p=LD.el&&LD.el.querySelector('.ld-tip');if(!p)return;const L=loaderLines();if(!L.length)return;p.classList.add('out');setTimeout(()=>{p.textContent=L[LD.tipI++%L.length];p.classList.remove('out')},350)}
function loadOne(p){artImg(p);return ART.wait[p].then(async im=>{if(!(im&&im.naturalWidth))return false;try{if(im.decode)await im.decode()}catch(e){}return true})}
function loadSvg(k){return new Promise(res=>{const im=new Image();im.onload=()=>res(true);im.onerror=()=>res(false);im.src=UIURL(k)})}
/* loads phase by phase (files within a phase in parallel), then checks the world map and the scene you start in */
/* alpha 0.4.1: the title's town comes first. Its ground, props and buildings load before everything else, then it is
   put up behind the loading screen and builds itself while the rest comes in (onTown) */
function townPaths(){try{if(!(typeof titleWanted==='function'&&titleWanted()&&typeof csWanted==='function'&&csWanted()))return new Set();const id=sceneIdAt(START_NODE),sc=dioScene(id);return sc?new Set(dioPaths(sc)):new Set()}catch(e){console.error(e);return new Set()}}
async function preloadAll(onTown){const L=loadList(),byPh=[[],[],[],[],[],[]],TP=townPaths();for(const p of TP)if(!L.has(p))L.set(p,0);for(const [p,ph] of L)byPh[TP.has(p)?0:ph+1].push(p);const T0=performance.now(),phT=[];
 const total=L.size+UI_SVG.length+2;let done=0;const fails=[];loaderSet(0,total,0);
 for(let ph=0;ph<byPh.length;ph++){loaderSet(done,total,ph?ph-1:'Laying out the town');
  const jobs=byPh[ph].map(p=>loadOne(p).then(ok=>{if(!ok)fails.push(p);loaderSet(++done,total)}));
  if(ph===1)UI_SVG.forEach(k=>jobs.push(loadSvg(k).then(ok=>{if(!ok)fails.push(`ui/${k}.svg`);loaderSet(++done,total)})));
  const pt=performance.now();await Promise.all(jobs);phT.push({phase:ph?LOAD_PHASES[ph-1]:'the town',files:byPh[ph].length,ms:Math.round(performance.now()-pt)});if(ph===0&&onTown&&TP.size)try{onTown()}catch(e){console.error(e)}}
 /* the map needs its pixels, the first scene needs its ground built */
 if(location.protocol!=='file:'){try{await mapPrepare()}catch(e){fails.push(WORLD_ART+' (pixels: '+e.message+')')}}
 loaderSet(++done,total);
 try{if(S.started){const area=areaKey();await scPrepare(AREAS[area]?area:'grass')}}catch(e){console.error(e)}
 loaderSet(++done,total);
 if(typeof NWLOG!=='undefined'){NWLOG.load={ms:Math.round(performance.now()-T0),files:total,failed:fails.slice(0,50),phases:phT};NWLOG.add('load',`${total} files in ${NWLOG.load.ms} ms, ${fails.length} failed`)}
 return fails}
async function bootLoad(){LD.el=document.getElementById('loader');if(!LD.el)return artBoot();LD.shown=performance.now();document.body.classList.add('ld-on','from-ld');try{ldwInit()}catch(e){console.error(e)}
 if(typeof S!=='undefined'&&S&&S.gender==='boy')LD.el.classList.add('boy');
 LD.tipT=setInterval(loaderTip,3600);
 for(;;){const fails=await preloadAll(LD.town?null:townUp);
  if(!fails.length)break;
  console.error('Pocket Billies: art that failed to load:',fails);LD.el.classList.add('failed');LD.el.querySelector('.ld-phase').textContent=`${fails.length} file${fails.length===1?'':'s'} didn’t load`;
  const box=LD.el.querySelector('.ld-fail');box.hidden=false;
  box.innerHTML=`<b>Some art is missing or couldn’t be reached.</b><ul>${fails.slice(0,30).map(f=>`<li>${esc(f)}</li>`).join('')}</ul><p>Check your connection, or that the game folder is complete. You can still play; missing pictures just won’t show.</p><div class="ld-btns"><button data-ld="retry">Try again</button><button class="q" data-ld="go">Play anyway</button></div>`;
  const pick=await new Promise(res=>box.addEventListener('click',ev=>{const b=ev.target.closest('[data-ld]');if(b)res(b.dataset.ld)}));
  box.hidden=true;LD.el.classList.remove('failed');if(pick==='go')break;
  for(const f of fails){const p=f.split(' ')[0];delete ART.img[p];delete ART.wait[p]}}
 clearInterval(LD.tipT);LD.f=1;LDW.doneAt=performance.now();LD.el.classList.add('ready');LD.el.querySelector('.ld-phase').textContent='Ready';
 const wait=Math.max(RM?0:650,(RM?0:1400)-(performance.now()-LD.shown));await new Promise(r=>setTimeout(r,wait))}
/* wait (at most 5 s) until the walk scene has drawn a few frames, so its first, slow frame happens behind the loader */
async function sceneWarm(){if(!S.started||typeof DIO==='undefined')return;const t0=performance.now();if(LD.el)LD.el.querySelector('.ld-phase').textContent='Setting the scene';
 while(performance.now()-t0<5000){const ok=DIO.ready&&(typeof DGL==='undefined'||!DGL.on||DGL.frames>4)&&(typeof EGL==='undefined'||!EGL.normQ||!EGL.normQ.length);if(ok||!document.getElementById('dio'))break;await new Promise(r=>setTimeout(r,60))}
 if(typeof NWLOG!=='undefined')NWLOG.add('load',`scene ready in ${Math.round(performance.now()-t0)} ms`)}
/* the town behind the loader: the title starts, its town is put up and grows in as the loading goes on */
function townUp(){if(LD.town)return;LD.town=true;titleStart();titleMount();LD.el.classList.add('town');if(typeof dglRiseStart==='function')dglRiseStart(true)}
function loaderHide(){const el=LD.el;if(!el){document.body.classList.remove('ld-on');return}LD.f=1;
 const end=()=>{cancelAnimationFrame(LDW.raf);el.remove();LD.el=null;document.body.classList.remove('ld-on','ttl-reveal')};
 if(!(typeof TITLE!=='undefined'&&TITLE.on)){el.classList.add('done');document.body.classList.remove('ld-on');setTimeout(end,900);return}
 /* alpha 0.4.1: the title comes out of the loader. Wait (at most 9 s) for the town behind the title to be drawn, give
    the island a moment to finish, then open the town out of it */
 if(LD.town&&!document.body.classList.contains('ttl-flat')){const cv=document.getElementById('dio');if(cv)cv.style.clipPath='';el.classList.add('reveal');setTimeout(()=>{const top=el.querySelector('.ld-top');if(top)top.style.visibility='hidden';document.body.classList.remove('ld-on')},RM?0:700);setTimeout(end,RM?300:1400);return}
 const t0=performance.now(),go=()=>{const live=document.body.classList.contains('ttl-live'),flat=document.body.classList.contains('ttl-flat');
  if(!live&&!flat&&performance.now()-t0<9000)return setTimeout(go,120);
  if(flat||!live){el.classList.add('done');document.body.classList.remove('ld-on');setTimeout(end,900);return}
  document.body.classList.add('ttl-reveal');el.classList.add('reveal');if(typeof dglRiseStart==='function')dglRiseStart();
  setTimeout(()=>{const top=el.querySelector('.ld-top');if(top)top.style.visibility='hidden';document.body.classList.remove('ld-on')},RM?0:950);
  setTimeout(end,RM?300:2200)};
 setTimeout(go,RM?0:Math.max(0,900-(performance.now()-(LDW.doneAt||0))))}
/* v29: Pocket Billies Studio and an open game tab. A test run (?test=1&scene=<id>) is a throwaway game that starts in that
   scene and never touches your save; while the Studio is open, its edits to scenes, props and the engine reach the
   game as you make them (no saving needed to see them). */
const NW_TEST=(()=>{try{const q=new URLSearchParams(location.search);return q.get('test')?{scene:q.get('scene')}:null}catch(e){return null}})();
if(NW_TEST){lsSet=function(){};flush=async function(){};S=fresh()}
function studioTestStart(){if(!NW_TEST)return;U.pg='girl';startGame((RULES.start.starters||[])[0]);S.story={met_chad:1,met_chad2:1};U.modal=null;U.mq=[];renderOv();
 if(NW_TEST.scene&&dioScene(NW_TEST.scene))U.bench={id:NW_TEST.scene};U.tab='walk';render();toast(`Test run${NW_TEST.scene&&dioScene(NW_TEST.scene)?' of '+(dioScene(NW_TEST.scene).name||NW_TEST.scene):''}. Nothing here is saved.`)}
function studioLive(D){let any=false;for(const k of ['scenes','scenery','engine'])if(D[k]){GD[k]=D[k];any=true}if(!any)return;if(typeof WORLD!=='undefined'){WORLD.gen++;WORLD.cache.clear()}
 if(typeof DIO!=='undefined'&&DIO.id&&GD.scenes[DIO.id]){DIO.sc=GD.scenes[DIO.id];DIO.gkey='';DIO.nav=null;DIO.cand=null;if(typeof DGL!=='undefined'){DGL.hkey='';DGL.farKey=''}}
 if(typeof ENV!=='undefined')ENV.id=null;if(!studioLive.told){studioLive.told=1;toast('Showing your Studio edits as you make them.')}}
let NW_LINK=null;try{NW_LINK=new BroadcastChannel('networth-studio');NW_LINK.onmessage=ev=>{const m=ev.data||{};if(m.type==='data'&&m.D)try{studioLive(m.D)}catch(e){console.error(e)}}}catch(e){}
/* 0.1.0 alpha: the game needs WebGL 2 (there is no 2D fallback any more). Without it, or when it fails for good, a
   screen says so and offers a retry and the debug log */
function noWebGL(why){if(document.getElementById('nogl'))return;if(typeof NWLOG!=='undefined')NWLOG.add('webgl','no WebGL 2: '+(why||'unavailable'));
 const el=document.createElement('div');el.id='nogl';el.setAttribute('role','alertdialog');el.setAttribute('aria-labelledby','nogl-h');
 el.innerHTML=`<div class="nogl-card"><h1 id="nogl-h">This device can’t run Pocket Billies</h1><p>The game draws its world with WebGL 2, and this browser doesn’t offer it${why==='failed'?' any more (the graphics stopped working)':''}. An up-to-date Chrome, Safari or Firefox usually does; on a computer, hardware acceleration must be on.</p><div class="nogl-btns"><button data-ng="retry">Try again</button><button class="q" data-ng="log">Export debug log</button></div></div>`;
 el.addEventListener('click',ev=>{const b=ev.target.closest('[data-ng]');if(!b)return;if(b.dataset.ng==='retry')location.reload();else if(typeof exportDebugLog==='function')exportDebugLog()});
 document.body.appendChild(el)}
if(!eglOK())noWebGL();else artCacheCheck().then(()=>bootLoad()).then(async()=>{if(typeof NWLOG!=='undefined')NWLOG.hook();bgInit();if(typeof titleWanted==='function'&&titleWanted())titleStart();render();if(NW_TEST)studioTestStart();/* an open Studio sends its unsaved edits */if(NW_LINK)try{NW_LINK.postMessage({type:'hello'})}catch(e){}await sceneWarm();loaderHide();if(SAVE_FOUND==='old'||SAVE_FOUND==='new')setTimeout(()=>modal({title:SAVE_FOUND==='old'?'A new game':'A newer save',html:`<p>${SAVE_FOUND==='old'?SAVE_OLD_MSG+' It is kept aside in this browser, and a new game starts here.':SAVE_NEW_MSG}</p>`,btns:[{l:'OK',c:'gold',f:closeModal}]}),1200);if(S.started&&!NW_TEST)setTimeout(postProcess,500);
 if(location.protocol==='file:')setTimeout(()=>toast('Battles and the map need a local web server. Open the game with Start-Game (see README).'),900);
 if(DATA_WARN.length)console.info(`Pocket Billies: ${DATA_WARN.length} game data warning(s). Open the debug menu (Ctrl+Shift+D) to see them.`)});
if(typeof accInit==='function')accInit();
if('serviceWorker' in navigator&&location.protocol!=='file:')addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
