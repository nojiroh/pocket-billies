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
const LD={el:null,tipI:0,tipT:null,shown:0};
function loaderSet(done,total,phase){const el=LD.el;if(!el)return;const f=total?done/total:0,pct=Math.round(f*100);
 /* v47: the coins fill with gold as the runner passes them */
 const C=el.querySelectorAll('.ld-coins i'),n=Math.round(f*C.length);C.forEach((c,i)=>{const g=i<n;if(c.classList.contains('got')!==g)c.classList.toggle('got',g)});
 const run=el.querySelector('.ld-run');if(run)run.style.left=`calc(${(f*100).toFixed(1)}% - ${Math.round(f*40)}px)`;el.setAttribute('aria-valuenow',pct);
 el.querySelector('.ld-count').textContent=`${done} / ${total}`;if(phase!=null)el.querySelector('.ld-phase').textContent=LOAD_PHASES[phase]||phase}
/* v47: lines from the world (lore.loading: lore, tips and jokes) between the tips, a new one every few seconds */
function loaderLines(){if(!LD.lines){const W=typeof loreLoadingLines==='function'?loreLoadingLines():[],T=LOAD_TIPS.slice();LD.lines=[];while(W.length||T.length){if(W.length)LD.lines.push(W.shift());if(W.length)LD.lines.push(W.shift());if(T.length)LD.lines.push(T.shift())}}return LD.lines}
function loaderTip(){const p=LD.el&&LD.el.querySelector('.ld-tip');if(!p)return;const L=loaderLines();if(!L.length)return;p.classList.add('out');setTimeout(()=>{p.textContent=L[LD.tipI++%L.length];p.classList.remove('out')},350)}
function loadOne(p){artImg(p);return ART.wait[p].then(async im=>{if(!(im&&im.naturalWidth))return false;try{if(im.decode)await im.decode()}catch(e){}return true})}
function loadSvg(k){return new Promise(res=>{const im=new Image();im.onload=()=>res(true);im.onerror=()=>res(false);im.src=UIURL(k)})}
/* loads phase by phase (files within a phase in parallel), then checks the world map and the scene you start in */
async function preloadAll(){const L=loadList(),byPh=[[],[],[],[],[]];for(const [p,ph] of L)byPh[ph].push(p);const T0=performance.now(),phT=[];
 const total=L.size+UI_SVG.length+2;let done=0;const fails=[];loaderSet(0,total,0);
 for(let ph=0;ph<byPh.length;ph++){loaderSet(done,total,ph);
  const jobs=byPh[ph].map(p=>loadOne(p).then(ok=>{if(!ok)fails.push(p);loaderSet(++done,total)}));
  if(ph===0)UI_SVG.forEach(k=>jobs.push(loadSvg(k).then(ok=>{if(!ok)fails.push(`ui/${k}.svg`);loaderSet(++done,total)})));
  const pt=performance.now();await Promise.all(jobs);phT.push({phase:LOAD_PHASES[ph],files:byPh[ph].length,ms:Math.round(performance.now()-pt)})}
 /* the map needs its pixels, the first scene needs its ground built */
 if(location.protocol!=='file:'){try{await mapPrepare()}catch(e){fails.push(WORLD_ART+' (pixels: '+e.message+')')}}
 loaderSet(++done,total);
 try{if(S.started){const area=areaKey();await scPrepare(AREAS[area]?area:'grass')}}catch(e){console.error(e)}
 loaderSet(++done,total);
 if(typeof NWLOG!=='undefined'){NWLOG.load={ms:Math.round(performance.now()-T0),files:total,failed:fails.slice(0,50),phases:phT};NWLOG.add('load',`${total} files in ${NWLOG.load.ms} ms, ${fails.length} failed`)}
 return fails}
async function bootLoad(){LD.el=document.getElementById('loader');if(!LD.el)return artBoot();LD.shown=performance.now();
 if(typeof S!=='undefined'&&S&&S.gender==='boy')LD.el.classList.add('boy');
 LD.tipT=setInterval(loaderTip,3600);
 for(;;){const fails=await preloadAll();
  if(!fails.length)break;
  console.error('Pocket Billies: art that failed to load:',fails);LD.el.classList.add('failed');LD.el.querySelector('.ld-phase').textContent=`${fails.length} file${fails.length===1?'':'s'} didn’t load`;
  const box=LD.el.querySelector('.ld-fail');box.hidden=false;
  box.innerHTML=`<b>Some art is missing or couldn’t be reached.</b><ul>${fails.slice(0,30).map(f=>`<li>${esc(f)}</li>`).join('')}</ul><p>Check your connection, or that the game folder is complete. You can still play; missing pictures just won’t show.</p><div class="ld-btns"><button data-ld="retry">Try again</button><button class="q" data-ld="go">Play anyway</button></div>`;
  const pick=await new Promise(res=>box.addEventListener('click',ev=>{const b=ev.target.closest('[data-ld]');if(b)res(b.dataset.ld)}));
  box.hidden=true;LD.el.classList.remove('failed');if(pick==='go')break;
  for(const f of fails){const p=f.split(' ')[0];delete ART.img[p];delete ART.wait[p]}}
 clearInterval(LD.tipT);LD.el.classList.add('ready');LD.el.querySelector('.ld-phase').textContent='Ready';
 const wait=Math.max(RM?0:650,(RM?0:1400)-(performance.now()-LD.shown));await new Promise(r=>setTimeout(r,wait))}
/* wait (at most 5 s) until the walk scene has drawn a few frames, so its first, slow frame happens behind the loader */
async function sceneWarm(){if(!S.started||typeof DIO==='undefined')return;const t0=performance.now();if(LD.el)LD.el.querySelector('.ld-phase').textContent='Setting the scene';
 while(performance.now()-t0<5000){const ok=DIO.ready&&(typeof DGL==='undefined'||!DGL.on||DGL.frames>4)&&(typeof EGL==='undefined'||!EGL.normQ||!EGL.normQ.length);if(ok||!document.getElementById('dio'))break;await new Promise(r=>setTimeout(r,60))}
 if(typeof NWLOG!=='undefined')NWLOG.add('load',`scene ready in ${Math.round(performance.now()-t0)} ms`)}
function loaderHide(){const el=LD.el;if(!el)return;el.classList.add('done');setTimeout(()=>el.remove(),900)}
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
artCacheCheck().then(()=>bootLoad()).then(async()=>{if(typeof NWLOG!=='undefined')NWLOG.hook();bgInit();if(typeof titleWanted==='function'&&titleWanted())titleStart();render();if(NW_TEST)studioTestStart();/* an open Studio sends its unsaved edits */if(NW_LINK&&!window.NW_ARTIFACT)try{NW_LINK.postMessage({type:'hello'})}catch(e){}await sceneWarm();loaderHide();if(S.started&&!NW_TEST)setTimeout(postProcess,500);
 if(location.protocol==='file:')setTimeout(()=>toast('Battles and the map need a local web server. Open the game with Start-Game (see README).'),900);
 if(DATA_WARN.length)console.info(`Pocket Billies: ${DATA_WARN.length} game data warning(s). Open the debug menu (Ctrl+Shift+D) to see them.`)});
initCloud();
if('serviceWorker' in navigator&&location.protocol!=='file:'&&!window.NW_ARTIFACT)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
