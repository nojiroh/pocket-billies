'use strict';
/* ================= TITLE SCREEN =================
   v47: after loading, a slow camera over Sundown from above the rooftops (the real scene, drawn by the game, at your
   local time of day), the Pocket Billies logo in pixel lettering, title music, and three choices: Continue (your trainer,
   where you are and how long you've played), New game, Settings. On a phone one tap anywhere continues.
   Without the 3D scene the title stands on the painted landscape instead. */
const TITLE={on:false,t0:0,run:0,mounted:false};
function titleWanted(){return !(typeof NW_TEST!=='undefined'&&NW_TEST)&&!(S.preferences&&S.preferences.skipTitle)}
/* the camera: a slow drift along the front of the town, high above the rooftops, looking up the main street */
function titleFrame(){if(!TITLE.on||!DIO.sc)return null;const sc=DIO.sc,now=performance.now(),k=RM?.5:.5-.5*Math.cos((now-TITLE.t0)/1000*.05),
 /* (in the walk view the town is one part of a bigger picture: frame the town itself) */b=sc.baseId?dioScene(sc.baseId)||sc:sc,o=sc.baseOff||[0,0],
 x=o[0]+b.w*(.28+.44*k),gy=dioH(clamp(x,o[0]+1,o[0]+b.w-1),clamp(o[1]+b.h*.3,o[1]+1,o[1]+b.h-1)),eye=[x,gy+17,o[1]-4],tgt=[x+5,gy+1.2,o[1]+b.h*.36],fd=Math.hypot(tgt[0]-eye[0],tgt[1]-eye[1],tgt[2]-eye[2]);
 return {look:{eye,tgt,fov:44,w:0},items:[],lights:[],parts:[],hide:null,focus:fd,blur:.12,center:[tgt[0],tgt[2]],cut:2.6}}
function titlePlayTime(){const m=Math.floor((S.playMs||0)/60000);return m<1?'just started':m<60?`${m} min`:`${Math.floor(m/60)} h ${String(m%60).padStart(2,'0')} min`}
function renderTitle(){const cont=S.started&&S.avatar,place=cont&&ROUTE[S.route.node]?ROUTE[S.route.node].name:'',nm=cont?(S.avatar.name||'Trainer'):'';
 return `<div class="ttl${cont?' can-tap':''}" data-a="${cont?'ttltap':''}"><div class="ttl-bg" aria-hidden="true"></div>
  <div class="ttl-acc">${typeof accChipHTML==='function'?accChipHTML():''}</div><div class="ttl-top"><h1 class="ttl-logo" aria-label="Pocket Billies"><span>POCKET</span><span>BILLIES</span></h1><p class="ttl-tag">Gotta tax 'em all!</p></div><p class="ttl-ver">${esc(PB_VERSION)}</p>
  <div class="ttl-bottom">
   ${cont?`<button class="ttl-cont" data-a="ttlgo"><span class="ttl-face">${humanHTML('me',56)}</span><span class="ttl-ct"><b>Continue</b><small>${esc(nm)} · ${esc(place)}</small><small>${titlePlayTime()} played</small></span></button>`:''}
   <div class="ttl-btns">${cont?`<button class="pb quiet" data-a="ttlnew">New game</button>`:`<button class="pb gold big wide" data-a="intro">New game</button>`}<button class="pb quiet" data-a="ttlset">${uiIco('gear',14)} Settings</button></div>
   ${cont?'<p class="ttl-hint">Tap anywhere to continue</p>':''}</div></div>`}
/* the scene behind the title: Sundown, drawn by the walk renderer with the title camera */
async function titleMount(){if(TITLE.mounted||!TITLE.on)return;TITLE.mounted=true;if(typeof music==='function')music('title');
 if(typeof csWanted==='function'&&!csWanted()){document.body.classList.add('ttl-flat');return}
 const run=++TITLE.run;let cv=$('#dio');if(!cv){cv=document.createElement('canvas');cv.id='dio';document.body.prepend(cv)}cv.hidden=false;cv.setAttribute('aria-label',(typeof csStartName==='function'?csStartName():'The town')+', from above the rooftops');
 TITLE.t0=performance.now();DIO.director={frame:titleFrame};
 try{await dioMount(cv,typeof csSceneId==='function'?csSceneId():sceneIdAt(START_NODE),{state:()=>({who:null,npcs:[],enc:[],mode:'line'}),keys:()=>false,active:()=>false,onPick:()=>{},cap:()=>document.hidden?1:Math.min(30,userFps())})}catch(e){console.error(e)}
 if(!TITLE.on||run!==TITLE.run)return;if(!DGL.on||!DIO.ready){document.body.classList.add('ttl-flat');return}DIO.cv.classList.add('in');
 /* the painted landscape stays in front until the town's ground is laid and drawn, then fades away */
 const t0=performance.now(),poll=()=>{if(!TITLE.on||run!==TITLE.run)return;if(DGL.gtex&&DGL.frames>3||performance.now()-t0>20000){document.body.classList.add('ttl-live');return}setTimeout(poll,200)};poll()}
function titleStart(){if(TITLE.on)return;TITLE.on=true;TITLE.mounted=false;U.title=true;document.body.classList.add('in-title')}
function titleEnd(){if(!TITLE.on)return;TITLE.on=false;TITLE.run++;U.title=false;document.body.classList.remove('in-title','ttl-live','ttl-flat');if(DIO.director&&DIO.director.frame===titleFrame){DIO.director=null;DGL.camT=null;DGL.focus=null}if(DIO.cv)dioStop()}
function titleNew(){if(!S.started){titleEnd();if(typeof csWanted==='function'&&csWanted())csStart();else{U.intro=1;render()}return}
 modal({title:'Start a new game?',html:'<p>This replaces the game in this save slot: your team, Field Guide and money. (Settings → Save slots can keep a copy first.)</p>',btns:[
  {l:'Start a new game',c:'red',f:()=>{S=freshKeep();S.savedAt=Date.now();lsSet(S);flush();U.intro=0;U.pg=null;U.avatarDraft=null;U.trainerDraft=null;U.tab='walk';applyPreferences();closeModal();titleEnd();if(typeof csWanted==='function'&&csWanted())csStart();else{U.intro=1;render()}}},
  {l:'Keep playing this one',c:'quiet',f:closeModal}]})}
/* play time: counted while the game is open and in view */
setInterval(()=>{if(typeof S!=='undefined'&&S&&S.started&&!document.hidden&&!U.title)S.playMs=(S.playMs||0)+15000},15000);
document.addEventListener('click',ev=>{if(!TITLE.on)return;const el=ev.target.closest('[data-a]'),a=el&&el.dataset.a;if(!a)return;
 if(a==='intro'){titleEnd();return}/* a new game from the title: the opening takes over (ui.js starts it) */
 if(a==='ttlgo'||a==='ttltap'&&!ev.target.closest('button')){ev.stopPropagation();titleEnd();if(typeof music==='function'&&typeof musicFor==='function')music(musicFor());render();if(typeof postProcess==='function')setTimeout(postProcess,400);return}
 if(a==='ttlnew'){ev.stopPropagation();titleNew();return}
 if(a==='ttlset'){ev.stopPropagation();settings();return}},true);
document.addEventListener('keydown',ev=>{if(!TITLE.on||U.modal)return;if((ev.key==='Enter'||ev.key===' ')&&S.started){ev.preventDefault();titleEnd();render()}});
