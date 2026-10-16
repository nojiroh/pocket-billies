/* ================= CORE ================= */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const rnd=Math.random;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Math.floor(n).toLocaleString('en-US');
const km=st=>(st/STEPS_PER_KM).toFixed(1);
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const uid=()=>'m'+Date.now().toString(36)+Math.floor(rnd()*1e8).toString(36);
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const plural=(n,w)=>`${fmt(n)} ${w}${n===1?'':'s'}`;
function pickW(list){const tot=list.reduce((a,b)=>a+b[1],0);let r=rnd()*tot;for(const [id,w] of list){r-=w;if(r<=0)return id}return list[0][0]}

/* ---------- state ---------- */
function fresh(){return{v:2,started:false,gender:null,starter:null,team:[],box:[],seen:{},caught:{},se:600,seFrac:0,coins:{penny:5,silver:0,gold:0,tbtf:0},
 items:{taxbreak:2,loophole:0,apology:0,settlement:0,appeal:0,bailout:0,bell:0},day:{date:today(),steps:0},totalSteps:0,route:{node:0,prog:0},mapSeen:null,meter:0,queue:[],
 buddy:null,buddyRem:0,flags:{},seats:[],serial:300,eggs:[],jobs:[0,1,2].map(()=>({uid:null,job:null,acc:0,pend:0})),savedAt:0}}
function migrate(o){if(!o||typeof o!=='object')return null;const f=fresh();const s=Object.assign(f,o);
 s.coins=Object.assign(fresh().coins,o.coins||{});s.items=Object.assign(fresh().items,o.items||{});s.flags=o.flags||{};
 if(!Array.isArray(s.eggs))s.eggs=[];if(!Array.isArray(s.jobs)||s.jobs.length!==3)s.jobs=fresh().jobs;
 [...(s.team||[]),...(s.box||[])].forEach(m=>{if(!SP[m.sp])m.sp='trust0'});
 if(s.started&&!s.team.length&&!s.box.length)return fresh();s.v=2;return s}
const LS='networth-save-v1';
function lsGet(){try{return JSON.parse(localStorage.getItem(LS)||'null')}catch(e){return null}}
function lsSet(o){try{localStorage.setItem(LS,JSON.stringify(o))}catch(e){}}
let S=migrate(lsGet())||fresh();
let B=null;
const U={tab:'walk',lastTab:null,intro:0,modal:null,mq:[],learnQ:[],walking:false,motionMsg:'',toastQ:[],toastOn:false,evT:null,throwing:false,disp:{steps:null,se:null},seenEnc:new Set(),mapSel:null};

/* ---------- cloud save (per-person, private) ---------- */
let DB=null,USERID=null,saveT=null,saving=false,again=false;
function save(){S.savedAt=Date.now();lsSet(S);if(!saveT)saveT=setTimeout(()=>{saveT=null;flush()},4000)}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&saveT){clearTimeout(saveT);saveT=null;flush()}});
async function flush(){if(!DB||!USERID)return;if(saving){again=true;return}saving=true;
 try{await DB.doc('data/users/'+USERID+'/save').set({json:JSON.stringify(S),savedAt:S.savedAt})}catch(e){if(e&&e.code==='invalid_argument')DB=null}
 saving=false;if(again){again=false;flush()}}
async function initCloud(){
 try{if(!window.claude||typeof window.claude.use!=='function')return;
  const [db,user]=await Promise.all([window.claude.use('db'),window.claude.use('user')]);if(!db||!user)return;
  const id=await user.id();if(!id)return;DB=db;USERID=id;
  const snap=await db.doc('data/users/'+id+'/save').get();
  if(snap.exists){const d=snap.data();let remote=null;try{remote=migrate(JSON.parse(d.json))}catch(e){}
   if(remote&&remote.started&&(!S.started||(remote.savedAt||0)>(S.savedAt||0))&&!B){S=remote;lsSet(S);render();toast('Your progress is synced.');setTimeout(postProcess,200)}
   else if(S.started)flush()}
  else if(S.started)flush();
 }catch(e){}
}

/* ---------- billionaires ---------- */
const xpFor=L=>Math.floor(.8*L*L*L);
function stat(m,k){const b=SP[m.sp].base[STATK.indexOf(k)];return k==='hp'?Math.floor(2*b*m.lvl/100)+m.lvl+10:Math.floor(2*b*m.lvl/100)+5}
const maxHp=m=>stat(m,'hp');
function movesAt(lid,lvl){const out=[];for(const [lv,mv] of LN[lid].learn)if(lv<=lvl&&!out.includes(mv))out.push(mv);return out.slice(-4)}
function makeMon(sp,lvl,o={}){const m={uid:uid(),sp,lvl,xp:xpFor(lvl),hp:0,status:null,sTurns:0,moves:movesAt(SP[sp].line,lvl),gold:!!o.gold,nick:''};m.hp=maxHp(m);return m}
const N=m=>m.nick||SP[m.sp].name;
const allMons=()=>S.team.concat(S.box);
const findMon=id=>allMons().find(m=>m.uid===id);
function gainXp(m,amt,say){if(m.lvl>=100||amt<=0)return;m.xp+=amt;
 while(m.lvl<100&&m.xp>=xpFor(m.lvl+1)){const old=maxHp(m);m.lvl++;if(m.hp>0)m.hp=Math.min(maxHp(m),m.hp+maxHp(m)-old);
  say(`${N(m)} is now worth $${m.lvl}B.`,{k:'lvl',uid:m.uid});
  for(const [lv,mv] of LN[SP[m.sp].line].learn){if(lv!==m.lvl||m.moves.includes(mv))continue;
   if(m.moves.length<4){m.moves.push(mv);say(`${N(m)} learned ${MOVES[mv].n}.`)}else U.learnQ.push({uid:m.uid,mv})}}}
function evoReady(m){const e=SP[m.sp].evo;if(!e)return false;if(m.evoNo!=null&&m.lvl<=m.evoNo)return false;
 switch(e.k){case 'lvl':return m.lvl>=e.at;case 'buddy':return (m.bsteps||0)>=e.steps;
  case 'idle':return !!m.boxedAt&&!m.job&&S.box.includes(m)&&Date.now()-m.boxedAt>=e.ms&&m.lvl>=e.min;
  case 'streak':return (m.streak||0)>=e.n&&m.lvl>=e.min;default:return false}}
function evoHint(m){const s=SP[m.sp],e=s.evo;if(!e)return s.rar==='mythical'?'Does not evolve. Nobody knows what it would even become.':'Fully evolved.';
 const nx=SP[s.next],nm=S.seen[nx.id]?nx.name:'something bigger';
 switch(e.k){case 'lvl':return `Evolves at $${e.at}B into ${nm}.`;
  case 'buddy':return `Evolves after you walk ${km(e.steps)} km with it as your buddy, because someone else does the walking. ${km(m.bsteps||0)} of ${km(e.steps)} km so far.`;
  case 'item':return `Evolves when you ring an IPO Bell, once it’s worth $${e.min}B or more.`;
  case 'donate':return `Evolves after it donates ${e.n} items to charity, once it’s worth $${e.min}B. ${m.donated||0} of ${e.n} donated.`;
  case 'merge':return `Evolves by merging with another ${s.name}, once it’s worth $${e.min}B.`;
  case 'idle':return `Evolves after a full day untouched in your Portfolio, once it’s worth $${e.min}B. Old money grows on its own.`;
  case 'streak':return `Evolves after winning ${e.n} battles in a row as your lead, once it’s worth $${e.min}B. Streak: ${m.streak||0}.`;
  case 'rename':return `Evolves when you rename it, once it’s worth $${e.min}B.`}return ''}
function evolve(m){const old=maxHp(m),from=N(m);m.sp=SP[m.sp].next;if(m.hp>0)m.hp=Math.max(1,Math.min(maxHp(m),m.hp+maxHp(m)-old));S.caught[m.sp]=1;S.seen[m.sp]=1;m.evoNo=null;m.streak=0;m.donated=0;return from}
function healAll(){for(const m of allMons()){m.hp=maxHp(m);m.status=null;m.sTurns=0}}
function toBox(m){const i=S.team.indexOf(m);if(i>=0)S.team.splice(i,1);if(!S.box.includes(m))S.box.push(m);m.boxedAt=Date.now()}
function toTeam(m){const i=S.box.indexOf(m);if(i>=0)S.box.splice(i,1);if(!S.team.includes(m))S.team.push(m);m.boxedAt=null}
function addMon(m){S.caught[m.sp]=1;S.seen[m.sp]=1;if(S.team.length<6){S.team.push(m);return 'team'}m.boxedAt=Date.now();S.box.push(m);return 'box'}

/* ---------- steps ---------- */
const BR=[[8000,1],[15000,.5],[Infinity,.1]];
function taxed(a,b){let se=0,lo=0;for(const [hi,r] of BR){const s=Math.max(a,lo),e=Math.min(b,hi);if(e>s)se+=(e-s)*r;lo=hi}return se}
const rate=st=>st<8000?1:st<15000?.5:.1;
function rollDay(){if(S.day.date!==today())S.day={date:today(),steps:0}}
const LAST=ROUTE.length-1;
function gateMsg(){const nx=ROUTE[S.route.node+1];if(!nx||!nx.gate||S.seats.includes(nx.gate))return null;return `The escalators down to Route 2 open once you earn Chairman Crude’s Board Seat.`}
function areaPool(){const n=S.route.node;const nx=ROUTE[n+1];return POOLS[(nx&&!gateMsg()?nx:ROUTE[n]).pool]}
function spawn(gentle){const P=areaPool();let list=P.list;if(gentle){const my=SP[S.starter+'0'].types;list=list.filter(([id])=>!SP[id].types.some(t=>eff(t,my)>1))}
 const sp=pickW(list),lvl=P.lv[0]+Math.floor(rnd()*(P.lv[1]-P.lv[0]+1));S.queue.push({id:uid(),sp,lvl,gold:rnd()<1/512,no:++S.serial})}
function addSteps(n,quiet){if(!S.started||n<=0)return;rollDay();
 const a=S.day.steps,b=a+n,g=taxed(a,b)+S.seFrac,gi=Math.floor(g);S.seFrac=g-gi;S.se+=gi;S.day.steps=b;S.totalSteps+=n;
 const msgs=[];
 if(!gateMsg()&&S.route.node<LAST){S.route.prog+=n;
  while(S.route.node<LAST&&S.route.prog>=ROUTE[S.route.node+1].cost){S.route.prog-=ROUTE[S.route.node+1].cost;S.route.node++;msgs.push(`You reached ${ROUTE[S.route.node].name}.`);if(gateMsg()){S.route.prog=0;break}}
  if(S.route.node===LAST)S.route.prog=0}
 S.meter+=gi;let sp=0;while(S.meter>=500){S.meter-=500;if(S.queue.length<10){spawn();sp++}}
 const bud=findMon(S.buddy);if(bud)bud.bsteps=(bud.bsteps||0)+n;S.buddyRem+=n;const xp=Math.floor(S.buddyRem/5);S.buddyRem-=xp*5;
 const notes=[];if(bud&&xp>0)gainXp(bud,xp,t=>notes.push(t));
 S.eggs.forEach(e=>{if(e.slot!=null)e.prog=Math.min(EGGS[e.tier].need,e.prog+n)});
 S.jobs.forEach(j=>{if(!j.uid)return;j.acc+=n;while(j.acc>=JOB_STEPS){j.acc-=JOB_STEPS;if(j.pend<20)j.pend++}});
 if(!quiet||sp)toast(`+${fmt(n)} steps, +${fmt(gi)} SE${sp?`, ${plural(sp,'new encounter')}`:''}`);
 msgs.concat(notes).forEach(t=>toast(t));
 save();if(!B){render();if(typeof onStepsAdded==='function')onStepsAdded();postProcess()}}

/* ---------- Seed Rounds ---------- */
function autoSlot(){for(const sl of [0,1]){if(S.eggs.some(e=>e.slot===sl))continue;const e=S.eggs.find(e=>e.slot==null);if(e)e.slot=sl}}
function addEgg(tier){if(S.eggs.length>=8){toast('Your Seed Round pipeline is full. Hatch a few first.');return false}S.eggs.push({id:uid(),tier,prog:0,slot:null});autoSlot();return true}
const hatchable=()=>S.eggs.filter(e=>e.slot!=null&&e.prog>=EGGS[e.tier].need);
function hatchEgg(e){const T=EGGS[e.tier];let sp=pickW(T.list),gold=rnd()<(e.tier===10?1/128:1/512);if(e.tier===10&&rnd()<1/1000){sp='myth0';gold=false}
 const m=makeMon(sp,T.lv,{gold});S.eggs=S.eggs.filter(x=>x!==e);autoSlot();const where=addMon(m);save();return {m,where}}

/* ---------- Day Jobs ---------- */
function assignJob(slot,job,id){const m=findMon(id);if(!m||m.job!=null)return false;if(S.team.includes(m)&&S.team.filter(x=>x.job==null).length<=1)return false;
 toBox(m);m.boxedAt=null;m.job=slot;S.jobs[slot]={uid:id,job,acc:0,pend:0};save();return true}
function collectJob(slot){const j=S.jobs[slot];if(!j.uid||!j.pend)return null;const J=JOBS[j.job],[kind,key,amt]=J.out,n=j.pend;j.pend=0;
 if(kind==='item')S.items[key]+=amt*n;else if(kind==='coin')S.coins[key]+=amt*n;else S.se+=amt*n;save();
 const m=findMon(j.uid);return `${m?N(m):'Your billionaire'} ${J.quip} You collected ${kind==='se'?fmt(amt*n)+' SE':`${amt*n} × ${kind==='item'?ITEMS[key].n:COINS[key].n}`}.`}
function endShift(slot){const j=S.jobs[slot];const msg=collectJob(slot);const m=findMon(j.uid);if(m){m.job=null;m.boxedAt=Date.now()}S.jobs[slot]={uid:null,job:null,acc:0,pend:0};save();return msg}
