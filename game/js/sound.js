'use strict';
/* ================= SOUND AND MUSIC =================
   Everything is synthesized with the Web Audio API: no sound files. Music is a small tracker: each song is a key, a
   tempo, a chord progression and a style; the melody is composed from the chords with a seeded random walk (so a
   song is the same every time), over a bass line, arpeggios or pads and drums. Sound effects are short synth
   recipes. Browsers only allow sound after the player touches the page, so nothing plays until the first tap.
   Settings → Music and Sound effects set the volumes (0 mutes). */
const AUD={ctx:null,master:null,mus:null,fx:null,noise:null,waves:{},song:null,want:null,timer:null,step:0,next:0,voices:[],lastStep:0};
function audPref(k,def){const p=(typeof S!=='undefined'&&S&&S.preferences)||{};return p[k]==null?def:+p[k]}
function audInit(){if(AUD.ctx)return true;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;try{
 const c=new AC();AUD.ctx=c;const comp=c.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=3;comp.connect(c.destination);
 AUD.master=c.createGain();AUD.master.gain.value=.9;AUD.master.connect(comp);AUD.mus=c.createGain();AUD.fx=c.createGain();/* v27: a filter on the music, closed a little in the rain */AUD.musLP=c.createBiquadFilter();AUD.musLP.type='lowpass';AUD.musLP.frequency.value=20000;AUD.mus.connect(AUD.musLP);AUD.musLP.connect(AUD.master);AUD.fx.connect(AUD.master);audApply();
 /* a soft echo for the music (caves get more of it) */
 const d=c.createDelay(1),fb=c.createGain(),wet=c.createGain();d.delayTime.value=.27;fb.gain.value=.28;wet.gain.value=.16;AUD.echoIn=c.createGain();AUD.echoIn.connect(d);d.connect(fb);fb.connect(d);d.connect(wet);wet.connect(AUD.mus);AUD.echoWet=wet;
 const n=c.createBuffer(1,c.sampleRate,c.sampleRate),nd=n.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;AUD.noise=n;
 const pw=duty=>{const N=32,re=new Float32Array(N),im=new Float32Array(N);for(let k=1;k<N;k++)im[k]=2/(k*Math.PI)*Math.sin(k*Math.PI*duty);return c.createPeriodicWave(re,im)};
 AUD.waves.p25=pw(.25);AUD.waves.p12=pw(.125);AUD.waves.p50=pw(.5);if(typeof NWLOG!=='undefined')NWLOG.add('audio','ready '+c.sampleRate+' Hz');return true}catch(e){AUD.ctx=null;return false}}
/* alpha 0.5: a master volume and mute over everything (music, effects, world sounds, ambience all go through the master) */
function audApply(){if(!AUD.ctx)return;const m=audPref('music',.55),f=audPref('sfx',.8),t=AUD.ctx.currentTime,mv=S.preferences&&S.preferences.mute?0:audPref('master',1);AUD.master.gain.setTargetAtTime(.9*mv*mv,t,.05);AUD.mus.gain.setTargetAtTime(m*m,t,.05);AUD.fx.gain.setTargetAtTime(f*f,t,.05)}
/* the first touch unlocks sound; the song that was asked for starts then */
function audUnlock(){if(!audInit())return;if(AUD.ctx.state==='suspended')AUD.ctx.resume();if(AUD.want&&!AUD.song)music(AUD.want)}
['pointerdown','keydown','touchend'].forEach(e=>addEventListener(e,audUnlock,{capture:true,passive:true}));
document.addEventListener('visibilitychange',()=>{if(!AUD.ctx)return;if(document.hidden)AUD.ctx.suspend();else AUD.ctx.resume()});
const mtof=m=>440*Math.pow(2,(m-69)/12);
/* ---------- instruments ---------- */
function audVoice(bus,{type='p25',freq,t,dur,vol=.1,a=.005,d=.08,s=.6,r=.08,slide=0,vib=0,cut=0,echo=0}){const c=AUD.ctx,o=c.createOscillator(),g=c.createGain();
 if(AUD.waves[type])o.setPeriodicWave(AUD.waves[type]);else o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*slide),t+dur);
 if(vib){const l=c.createOscillator(),lg=c.createGain();l.frequency.value=5.5;lg.gain.value=freq*.012*vib;l.connect(lg);lg.connect(o.frequency);l.start(t+.08);l.stop(t+dur+r)}
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+a);g.gain.linearRampToValueAtTime(vol*s,t+a+d);g.gain.setValueAtTime(vol*s,t+Math.max(a+d,dur));g.gain.linearRampToValueAtTime(0,t+Math.max(a+d,dur)+r);
 let out=g;if(cut){const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=cut;g.connect(f);out=f}o.connect(g);out.connect(bus);if(echo&&AUD.echoIn){const e=c.createGain();e.gain.value=echo;out.connect(e);e.connect(AUD.echoIn)}
 o.start(t);o.stop(t+Math.max(a+d,dur)+r+.02)}
function audNoise(bus,{t,dur=.05,vol=.2,hp=0,lp=0,bp=0,q=1}){const c=AUD.ctx,s=c.createBufferSource(),g=c.createGain();s.buffer=AUD.noise;s.loop=true;/* v47: longer than the one-second buffer (the fall) */let n=s;
 for(const [type,f] of [['highpass',hp],['lowpass',lp],['bandpass',bp]])if(f){const F=c.createBiquadFilter();F.type=type;F.frequency.value=f;F.Q.value=q;n.connect(F);n=F}
 g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);n.connect(g);g.connect(bus);s.start(t,Math.random()*.5);s.stop(t+dur+.02)}
function audKick(bus,t,v=.5){const c=AUD.ctx,o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(42,t+.12);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+.2);o.connect(g);g.connect(bus);o.start(t);o.stop(t+.22)}

/* ---------- songs ---------- */
const SCALES={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],lydian:[0,2,4,6,7,9,11],mixo:[0,2,4,5,7,9,10]};
const SONGS={
 town:{bpm:100,key:60,scale:'major',prog:[0,5,3,4,0,5,1,4],lead:'p25',bass:'bounce',arp:'up',drums:'soft',seed:3,swing:.08},
 route:{bpm:122,key:67,scale:'major',prog:[0,3,5,4,0,3,1,4],lead:'p25',bass:'gallop',arp:'updown',drums:'skip',seed:11},
 cave:{bpm:80,key:57,scale:'dorian',prog:[0,6,5,6,0,3,6,4],lead:'triangle',bass:'long',arp:'drip',drums:'none',seed:21,echo:.55},
 city:{bpm:116,key:63,scale:'mixo',prog:[0,3,4,3,0,5,3,4],lead:'p50',bass:'walk',arp:'chord7',drums:'skip',seed:91,seventh:1,swing:.06},
 mall:{bpm:108,key:65,scale:'lydian',prog:[0,1,2,1,0,1,3,4],lead:'p50',bass:'walk',arp:'chord7',drums:'bossa',seed:31,seventh:1},
 hazel:{bpm:88,key:65,scale:'major',prog:[0,3,4,0,5,3,1,4],lead:'triangle',bass:'long',arp:'up',drums:'none',seed:41,echo:.3},
 map:{bpm:96,key:62,scale:'mixo',prog:[0,6,3,0,0,6,4,4],lead:'p25',bass:'long',arp:'updown',drums:'soft',seed:51},
 wild:{bpm:152,key:64,scale:'minor',prog:[0,5,6,0,0,5,3,4],lead:'p25',bass:'drive',arp:'up',drums:'drive',seed:61},
 trainer:{bpm:162,key:62,scale:'minor',prog:[0,3,6,2,0,3,4,4],lead:'p12',bass:'drive',arp:'updown',drums:'march',seed:71},
 rival:{bpm:146,key:59,scale:'minor',prog:[0,6,5,6,0,6,3,4],lead:'p25',bass:'drive',arp:'up',drums:'drive',seed:81},
 /* v47: the title, the fall into the Hollow Earth, the Variants, the Inner Sun */
 title:{bpm:92,key:62,scale:'major',prog:[0,4,5,3,0,4,1,4],lead:'p25',bass:'long',arp:'updown',drums:'soft',seed:7,echo:.35},
 fall:{bpm:72,key:57,scale:'dorian',prog:[0,6,5,6,0,3,6,4],lead:'triangle',bass:'long',arp:'drip',drums:'none',seed:13,echo:.6},
 variants:{bpm:132,key:61,scale:'minor',prog:[0,5,3,6,0,5,4,4],lead:'p12',bass:'bounce',arp:'chord7',drums:'march',seed:23,seventh:1},
 innersun:{bpm:140,key:64,scale:'mixo',prog:[0,6,3,4,0,6,5,4],lead:'p25',bass:'drive',arp:'updown',drums:'drive',seed:29},
 /* v47 part 4: a song for each region (a place names it as "music") */
 meadow:{bpm:112,key:67,scale:'lydian',prog:[0,3,4,0,5,3,4,4],lead:'triangle',bass:'bounce',arp:'updown',drums:'soft',seed:101,swing:.1},
 hills:{bpm:100,key:65,scale:'mixo',prog:[0,4,3,0,5,4,3,4],lead:'p50',bass:'walk',arp:'chord7',drums:'bossa',seed:111,seventh:1,swing:.08},
 spore:{bpm:84,key:59,scale:'dorian',prog:[0,3,6,3,0,5,6,4],lead:'triangle',bass:'long',arp:'drip',drums:'soft',seed:121,echo:.45},
 crystal:{bpm:90,key:57,scale:'dorian',prog:[0,5,3,6,0,5,4,4],lead:'triangle',bass:'long',arp:'drip',drums:'soft',seed:131,echo:.5},
 trench:{bpm:84,key:55,scale:'minor',prog:[0,6,3,4,0,6,5,4],lead:'p50',bass:'long',arp:'updown',drums:'soft',seed:141,echo:.45,swing:.06},
 spire:{bpm:124,key:62,scale:'lydian',prog:[0,4,5,3,0,4,1,4],lead:'p12',bass:'bounce',arp:'chord7',drums:'skip',seed:151,seventh:1},
 /* alpha 0.4: Copperleaf, the hamlet where it all starts: an easy, swinging tune for round doors and beehives */
 copperleaf:{bpm:94,key:67,scale:'major',prog:[0,4,5,3,0,4,3,4],lead:'p25',bass:'bounce',arp:'up',drums:'soft',seed:171,swing:.14,echo:.25}};
/* a seeded random number generator, so a song is composed the same way every time */
function audRng(seed){let s=seed*9301+49297;return ()=>{s=(s*9301+49297)%233280;return s/233280}}
function audCompose(name){const D=SONGS[name];if(!D)return null;if(D.notes)return D;const sc=SCALES[D.scale],R=audRng(D.seed),deg=n=>{const o=Math.floor(n/7),i=((n%7)+7)%7;return D.key+12*o+sc[i]};
 const bars=D.prog.length,steps=bars*16,lead=new Array(steps).fill(null);
 const rhythms=[[0,4,6,8,12],[0,2,4,8,10,12],[0,3,6,8,12,14],[0,4,8,10,12],[0,6,8,12],[0,2,4,6,8,12]];
 const makeBar=(b,rng)=>{const ch=D.prog[b],rh=rhythms[Math.floor(rng()*rhythms.length)];let cur=ch+7+[0,2,4][Math.floor(rng()*3)];const out=[];
  rh.forEach((st,i)=>{const strong=st%8===0;if(strong){const tones=[ch,ch+2,ch+4].map(x=>x+7);cur=tones.reduce((a,b)=>Math.abs(b-cur)<Math.abs(a-cur)?b:a)}else cur+=[-2,-1,1,2,1,-1][Math.floor(rng()*6)];
   const len=(rh[i+1]??16)-st;out.push([st,deg(cur),len])});return out};
 /* bars 1-4 a phrase, 5-6 repeat its start, 7-8 a cadence that lands on the home note */
 const A=[0,1,2,3].map(b=>makeBar(b,R)),R2=audRng(D.seed+7);
 for(let b=0;b<bars;b++){let bar=b<4?A[b]:b<6?A[b-4]:makeBar(b,R2);
  if(b===bars-1)bar=[[0,deg(D.prog[b]+7+2),4],[4,deg(D.prog[b]+7),4],[8,deg(7),8]];const sh=D.key>=64?-12:0;bar.forEach(([s,n,l])=>{lead[b*16+s]=[n+sh,l]})}
 return Object.assign(D,{notes:lead,steps,deg})}
function music(name){AUD.want=name;if(!AUD.ctx||AUD.ctx.state!=='running'){return}if(AUD.song&&AUD.song.name===name)return;const D=audCompose(name);if(!D)return;
 if(AUD.song){const old=AUD.song;old.fade=AUD.ctx.currentTime}AUD.song={name,D,step:0,next:AUD.ctx.currentTime+.08,gain:AUD.ctx.createGain()};
 AUD.song.gain.connect(AUD.mus);AUD.song.drums=AUD.ctx.createGain();AUD.song.drums.gain.value=AUD.L?AUD.L.drums:1;AUD.song.drums.connect(AUD.song.gain);AUD.song.gain.gain.setValueAtTime(0,AUD.ctx.currentTime);AUD.song.gain.gain.linearRampToValueAtTime(1,AUD.ctx.currentTime+.6);
 for(const v of AUD.voices){const t=AUD.ctx.currentTime;v.gain.gain.cancelScheduledValues(t);v.gain.gain.setValueAtTime(v.gain.gain.value,t);v.gain.gain.linearRampToValueAtTime(0,t+.5);setTimeout(()=>v.gain.disconnect(),700)}AUD.voices=[AUD.song];
 if(!AUD.timer)AUD.timer=setInterval(audTick,25)}
function musicStop(){if(AUD.song){const t=AUD.ctx.currentTime,g=AUD.song.gain;g.gain.setValueAtTime(g.gain.value,t);g.gain.linearRampToValueAtTime(0,t+.4);setTimeout(()=>g.disconnect(),600)}AUD.song=null;AUD.want=null;AUD.voices=[]}
function audTick(){const c=AUD.ctx,sg=AUD.song;if(!c||!sg)return;const D=sg.D,spb=60/D.bpm/4;
 while(sg.next<c.currentTime+.14){const st=sg.step%D.steps,b=Math.floor(st/16),i=st%16,t=sg.next+(i%2?spb*(D.swing||0):0),bus=sg.gain,ch=D.prog[b],dg=D.deg;
  /* lead */const L=D.notes[st];if(L)audVoice(bus,{type:D.lead,freq:mtof(L[0]),t,dur:L[1]*spb*.9,vol:D.lead==='triangle'?.13:.075,d:.1,s:.55,r:.06,vib:L[1]>=6?1:0,echo:D.echo||.15});
  /* bass */const bs=D.bass,root=dg(ch)-24;
  if(bs==='bounce'&&i%4===0)audVoice(bus,{type:'triangle',freq:mtof(i%8?root+7:root),t,dur:spb*3,vol:.2,s:.7});
  else if(bs==='gallop'&&[0,3,4,8,11,12].includes(i))audVoice(bus,{type:'triangle',freq:mtof(i%8===4?root+12:root),t,dur:spb*1.5,vol:.2});
  else if(bs==='long'&&i===0)audVoice(bus,{type:'triangle',freq:mtof(root),t,dur:spb*15,vol:.16,a:.2,s:.8,r:.4});
  else if(bs==='walk'&&i%4===0)audVoice(bus,{type:'triangle',freq:mtof(dg(ch+[0,2,4,5][i/4])-24),t,dur:spb*3.5,vol:.2});
  else if(bs==='drive'&&i%2===0)audVoice(bus,{type:'p50',freq:mtof(root+(i%8===6?12:0)),t,dur:spb*1.6,vol:.07,cut:900});
  /* harmony */const ar=D.arp,tri=[0,2,4,D.seventh?6:7].map(x=>dg(ch+x)),pick=k=>tri[((k%4)+4)%4];
  if(ar==='up'&&i%2===0)audVoice(bus,{type:'p12',freq:mtof(pick(i/2)+12),t,dur:spb*1.2,vol:.035,s:.3,echo:.2});
  else if(ar==='updown'&&i%2===0){const k=i/2,seq=[0,1,2,3,2,1,0,1];audVoice(bus,{type:'p12',freq:mtof(pick(seq[k%8])+12),t,dur:spb*1.2,vol:.035,s:.3,echo:.15})}
  else if(ar==='drip'&&(i===0||i===6||i===11))audVoice(bus,{type:'sine',freq:mtof(pick(i)+24),t,dur:spb*2,vol:.05,s:.2,r:.3,echo:.7});
  else if(ar==='chord7'&&(i===0||i===6||i===10))tri.forEach(n=>audVoice(bus,{type:'sine',freq:mtof(n+12),t,dur:spb*(i===0?5:3),vol:.03,a:.02,s:.5,r:.2}));
  /* drums (v27: on their own bus, softer when you stand still or at night) */const dr=D.drums,db=sg.drums||bus;
  if(dr==='soft'){if(i===0||i===8)audKick(db,t,.25);if(i===4||i===12)audNoise(db,{t,dur:.08,vol:.08,bp:1800,q:.8});if(i%4===2)audNoise(db,{t,dur:.03,vol:.04,hp:7000})}
  else if(dr==='skip'){if(i===0||i===10)audKick(db,t,.3);if(i===4||i===12)audNoise(db,{t,dur:.1,vol:.1,bp:2000,q:.7});if(i%2===0)audNoise(db,{t,dur:.025,vol:.035,hp:8000})}
  else if(dr==='drive'){if(i%4===0)audKick(db,t,.42);if(i===4||i===12)audNoise(db,{t,dur:.12,vol:.14,bp:1800,q:.6});audNoise(db,{t,dur:.02,vol:i%2?.025:.045,hp:8000})}
  else if(dr==='march'){if(i===0||i===8||i===11)audKick(db,t,.42);if(i%4===2||i===14||i===15)audNoise(db,{t,dur:.07,vol:.11,bp:2400,q:.8});if(i%2===0)audNoise(db,{t,dur:.02,vol:.03,hp:9000})}
  else if(dr==='bossa'){if(i===0||i===6||i===8||i===14)audKick(db,t,.2);if([3,6,10,13].includes(i))audNoise(db,{t,dur:.03,vol:.05,bp:3500,q:2})}
  /* v27: a soft pad under the night */if(i===0&&AUD.L&&AUD.L.pad>.05)[0,2,4].forEach(x=>audVoice(bus,{type:'sine',freq:mtof(dg(ch+x)-12),t,dur:spb*15,vol:.022*AUD.L.pad,a:.6,s:.9,r:.8}));
  sg.step++;sg.next+=spb}}
/* the music that fits where you are */
function musicFor(){if(typeof S==='undefined'||!S||!S.started)return 'hazel';if(typeof B!=='undefined'&&B)return B.kind==='trainer'?(B.T&&B.T.who==='chad'?'rival':'trainer'):'wild';
 if(U.tab==='map')return 'map';const id=typeof sceneIdAt==='function'?sceneIdAt(S.route.node):null,sc=id&&dioScene(id),r=ROUTE[S.route.node];
 if(sc&&sc.indoor)return /mall|food/.test(id)?'mall':'cave';if(r&&r.music&&SONGS[r.music])return r.music;/* v47: a place's own song */if(/mall|food/.test(id||''))return 'mall';if(id==='city'||(r&&r.t==='city'))return 'city';return r&&r.town?'town':'route'}
function musicSync(){if(typeof CS!=='undefined'&&CS.on)return;if(AUD.jingle&&performance.now()<AUD.jingle)return;music(musicFor())}
setInterval(()=>{try{musicSync()}catch(e){}},1000);
/* a short tune that plays once (victory, level up, evolution), after which the place's music comes back */
function jingle(notes,bpm=150,type='p25'){if(!audInit()||AUD.ctx.state!=='running')return;const c=AUD.ctx,spb=60/bpm/4,t0=c.currentTime+.05;let t=t0;
 if(AUD.song){const g=AUD.song.gain.gain;g.cancelScheduledValues(t0);g.setValueAtTime(g.value,t0);g.linearRampToValueAtTime(.15,t0+.1)}
 for(const [n,l] of notes){if(n)audVoice(AUD.fx,{type,freq:mtof(n),t,dur:l*spb*.9,vol:.12,s:.6,echo:.2}),n&&audVoice(AUD.fx,{type:'triangle',freq:mtof(n-12),t,dur:l*spb*.9,vol:.12});t+=l*spb}
 const end=t-c.currentTime;AUD.jingle=performance.now()+end*1000+200;if(AUD.song){const g=AUD.song.gain.gain;g.linearRampToValueAtTime(.15,t);g.linearRampToValueAtTime(1,t+.8)}}
const JINGLES={victory:[[72,2],[76,2],[79,2],[84,6],[83,2],[84,8]],levelup:[[72,1],[76,1],[79,1],[84,3]],evolve:[[67,2],[71,2],[74,2],[79,2],[83,2],[86,6]],caught:[[79,2],[84,2],[88,4],[86,2],[88,6]],hatch:[[76,2],[79,2],[84,4]]};
/* ---------- sound effects ---------- */
function sfx(name,o={}){if(!AUD.ctx||AUD.ctx.state!=='running')return;const c=AUD.ctx,t=c.currentTime+.005,F=AUD.fx;
 switch(name){
  case 'tick':audVoice(F,{type:'p50',freq:1320,t,dur:.025,vol:.05,r:.02});break;
  case 'blip':{let h=0;for(const ch of String(o.who||''))h=(h*31+ch.charCodeAt(0))%997;const base=o.who==='gini'?72:o.who==='me'?67:/^folk/.test(o.who||'')?62+h%10:60+h%14;
   audVoice(F,{type:'p25',freq:mtof(base+[0,2,4,7][Math.floor(Math.random()*4)]),t,dur:.035,vol:.045,r:.02});break}
  case 'step':{if(o.ter==='n'){audNoise(F,{t,dur:.07,vol:.07,bp:2600,q:.9});audNoise(F,{t:t+.025,dur:.05,vol:.05,bp:4200,q:1.2});break}if(o.ter==='wet'){audNoise(F,{t,dur:.09,vol:.07,bp:1500,q:.5});audNoise(F,{t:t+.03,dur:.06,vol:.04,hp:5000});break}
   const k=o.ter||'g',soft=/[gGftn]/.test(k),wood=k==='b';audNoise(F,{t,dur:soft?.05:wood?.06:.035,vol:soft?.05:wood?.08:.07,bp:soft?900:wood?520:2200,q:soft?.6:wood?2.2:1.4});break}
  case 'throw':audVoice(F,{type:'p25',freq:600,t,dur:.18,vol:.06,slide:2.4});audNoise(F,{t,dur:.15,vol:.05,hp:3000});break;
  case 'pop':audVoice(F,{type:'p50',freq:900,t,dur:.05,vol:.07,slide:1.6});audNoise(F,{t:t+.02,dur:.1,vol:.08,bp:4000,q:1});break;
  case 'coin':[0,4,7,12].forEach((n,i)=>audVoice(F,{type:'p50',freq:mtof(84+n),t:t+i*.04,dur:.05,vol:.05}));break;
  case 'hit':audNoise(F,{t,dur:.12,vol:.25,lp:1800});audVoice(F,{type:'square',freq:180,t,dur:.08,vol:.08,slide:.4});break;
  case 'super':audNoise(F,{t,dur:.2,vol:.3,lp:3000});audVoice(F,{type:'square',freq:260,t,dur:.12,vol:.1,slide:.3});audVoice(F,{type:'p25',freq:880,t:t+.05,dur:.1,vol:.05,slide:1.5});break;
  case 'weak':audNoise(F,{t,dur:.08,vol:.14,lp:900});break;
  case 'crit':audNoise(F,{t,dur:.25,vol:.32,lp:4000});audVoice(F,{type:'square',freq:1200,t,dur:.15,vol:.06,slide:.25});audKick(F,t,.5);break;
  case 'miss':audNoise(F,{t,dur:.25,vol:.07,bp:600,q:.5});break;
  /* v47: the opening: the ground giving way, the long fall, the landing */
  case 'rumble':audNoise(F,{t,dur:1.4,vol:.22,lp:220});audKick(F,t,.35);audKick(F,t+.45,.3);audKick(F,t+.9,.25);break;
  case 'crack':audNoise(F,{t,dur:.35,vol:.3,bp:1400,q:.7});audNoise(F,{t:t+.08,dur:.4,vol:.18,lp:600});audKick(F,t,.45);break;
  case 'whoosh':audNoise(F,{t,dur:o.dur||1.6,vol:.12,bp:700,q:.4});audNoise(F,{t:t+.2,dur:(o.dur||1.6)*.8,vol:.07,hp:2400});break;
  case 'thud':audKick(F,t,.7);audNoise(F,{t,dur:.5,vol:.28,lp:500});audNoise(F,{t:t+.05,dur:.6,vol:.1,bp:2600,q:.5});break;
  case 'faint':audVoice(F,{type:'p25',freq:520,t,dur:.6,vol:.08,slide:.25});break;
  case 'enc':[0,7].forEach((n,i)=>audVoice(F,{type:'p25',freq:mtof(76+n),t:t+i*.09,dur:.08,vol:.08}));break;
  case 'heal':[0,4,7,11,14].forEach((n,i)=>audVoice(F,{type:'sine',freq:mtof(79+n),t:t+i*.06,dur:.12,vol:.06,echo:.4}));break;
  case 'status':audVoice(F,{type:'p12',freq:300,t,dur:.3,vol:.06,vib:3});break;
  case 'stat':audVoice(F,{type:'p25',freq:o.down?600:400,t,dur:.25,vol:.06,slide:o.down?.5:2});break;
  case 'buy':[0,7,12].forEach((n,i)=>audVoice(F,{type:'p50',freq:mtof(79+n),t:t+i*.05,dur:.06,vol:.05}));audNoise(F,{t:t+.15,dur:.15,vol:.05,hp:5000});break;
  case 'wobble':audVoice(F,{type:'triangle',freq:300,t,dur:.06,vol:.1,slide:.8});audNoise(F,{t,dur:.04,vol:.06,bp:1200});break;
  case 'run':audNoise(F,{t,dur:.3,vol:.08,bp:700,q:.4});break;
  case 'door':audNoise(F,{t,dur:.08,vol:.08,lp:600});audNoise(F,{t:t+.1,dur:.06,vol:.06,lp:500});break;
  case 'cry':{let h=0;for(const ch of String(o.sp||''))h=(h*31+ch.charCodeAt(0))%997;const b=48+h%24;audVoice(F,{type:['p25','p12','p50','square'][h%4],freq:mtof(b),t,dur:.18,vol:.07,slide:1.5+(h%5)*.2,vib:2});audVoice(F,{type:'p25',freq:mtof(b+5),t:t+.17,dur:.2,vol:.06,slide:.6});break}
 }}
/* battle animations make their sounds */
function sfxBattle(an,r){if(!an||!AUD.ctx)return;const at=(ms,f)=>setTimeout(f,Math.max(0,ms/(typeof SC!=='undefined'?SC.speed:1)));
 switch(an.k){case 'wild':sfx('enc');break;case 'cry':{const s=typeof SC!=='undefined'&&SC.s[an.si||1];sfx('cry',{sp:s&&s.sp});break}
  case 'enter':sfx('throw');at(380,()=>sfx('pop'));break;case 'faint':sfx('faint');break;case 'heal':sfx('heal');break;case 'status':sfx('status');break;case 'stat':sfx('stat',{down:an.n<0||an.down});break;
  case 'move':if(an.miss){at(r.hit||300,()=>sfx('miss'));break}if(an.self||an.protect){sfx('status');break}at(r.hit||300,()=>sfx(an.crit?'crit':an.te>1?'super':an.te<1?'weak':'hit'));break;
  case 'caught':jingle(JINGLES.caught);break;case 'lvl':jingle(JINGLES.levelup,180);break;case 'run':sfx('run');break}}
/* footsteps while walking */
setInterval(()=>{try{if(typeof DIO==='undefined'||!DIO.ready||!DIO.pl||!DIO.pl.walk||document.hidden||(typeof B!=='undefined'&&B))return;const P=DIO.pl;let ter=typeof dioTer==='function'?dioTer(P.x,P.z):'g';
 /* v18: hollow boards on wooden and rope bridges, stone on stone bridges and stairs */
 if(typeof dioBridgeAt==='function'&&dioBridgeAt(P.x,P.z)!=null){const b=(dioBridges()||[]).find(b=>{const vx=P.x-b.a[0],vz=P.z-b.a[1],t=(vx*b.ux+vz*b.uz)/b.len;return t>=-.05&&t<=1.05&&Math.abs(-vx*b.uz+vz*b.ux)<=b.w/2+.05});ter=b&&b.kind==='stone'?'e':'b'}
 else if(typeof dioStepM==='function'){if((dioStepM(P.x,P.z)&15)===8)ter='e'}
 if(typeof ENV!=='undefined'&&ENV.on&&DIO.sc&&!DIO.sc.indoor&&ENV.wet>.5&&!/[bew]/.test(ter))ter='wet';if(typeof ENV!=='undefined'&&ENV.on&&ENV.sk&&ENV.sk[3]>.3&&/[gGflt]/.test(ter))ter='n';
 sfx('step',{ter})}catch(e){}},330);
/* volume sliders apply while you drag */
document.addEventListener('input',ev=>{const k=ev.target.dataset&&ev.target.dataset.preference;if(k!=='music'&&k!=='sfx'&&k!=='world')return;S.preferences=S.preferences||{};S.preferences[k]=+ev.target.value/100;audApply();if(typeof ambApply==='function')ambApply();if(k==='sfx')sfx('tick')});
/* a soft tick on every button */
document.addEventListener('click',ev=>{const b=ev.target.closest&&ev.target.closest('button,[role=tab]');if(b&&!b.disabled)sfx('tick')},true);

/* ================= v27: SOUNDS OF THE WORLD =================
   Beds of sound that swell as you walk near running water, waterfalls, the sea, ponds, fountains and fires, plus the
   rain, the wind and thunder (env.js), each placed left or right of you; animals call and scurry from where they are.
   The music listens too: its drums soften while you stand still or at night, a pad hums under the night, and it
   sounds a little muffled in the rain. Settings → World sounds sets the volume (0 mutes). */
/* v31: world sounds are half as loud by default and fade in over a few seconds when you arrive somewhere; a second
   bus carries the ambience (Settings → Sound → Ambience): birdsong by day, crickets and the odd owl at night, leaves
   in the wind near trees, a town's murmur, a cave's hum and a room's quiet with its clock ticking */
const AMB={bus:null,amb:null,beds:{},flash:0,arrive:0,id:null,lastCall:0,ev:{}};
function ambFade(){if(!AUD.ctx)return 1;return clamp((AUD.ctx.currentTime-AMB.arrive)/2.8,0,1)}
function ambApply(){if(!AMB.bus||!AUD.ctx)return;const v=audPref('world',.5),a=audPref('amb',.5),f=ambFade(),t=AUD.ctx.currentTime;AMB.bus.gain.setTargetAtTime(v*v*f,t,.1);if(AMB.amb)AMB.amb.gain.setTargetAtTime(a*a*.9*f,t,.1)}
function ambInit(){if(AMB.bus)return true;if(!AUD.ctx||AUD.ctx.state!=='running')return false;const c=AUD.ctx;AMB.bus=c.createGain();AMB.bus.gain.value=0;AMB.bus.connect(AUD.master);AMB.amb=c.createGain();AMB.amb.gain.value=0;AMB.amb.connect(AUD.master);
 /* v47: the outdoors comes through a low-pass of its own, closed down when you are in a room laid into the place:
    the town's murmur, the birds, the rain on the roof and the fountain outside reach you through the walls */
 const lp=to=>{const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=20000;f.Q.value=.5;f.connect(to);return f};AMB.lpA=lp(AMB.amb);AMB.lpW=lp(AMB.bus);ambApply();
 const loop=(filters,lfo,rate=1)=>dest=>{const s=c.createBufferSource();s.buffer=AUD.noise;s.loop=true;s.playbackRate.value=rate;let n=s;for(const [type,f,q] of filters){const F=c.createBiquadFilter();F.type=type;F.frequency.value=f;F.Q.value=q||.7;n.connect(F);n=F}
  if(lfo){const m=c.createGain();m.gain.value=1-lfo[1];const o=c.createOscillator();o.frequency.value=lfo[0];const og=c.createGain();og.gain.value=lfo[1];o.connect(og);og.connect(m.gain);o.start();n.connect(m);n=m}n.connect(dest);s.start(0,Math.random()*.9)};
 const bed=(name,make,bus=AMB.lpW)=>{const g=c.createGain();g.gain.value=0;const p=c.createStereoPanner?c.createStereoPanner():null;make(g);if(p){g.connect(p);p.connect(bus)}else g.connect(bus);AMB.beds[name]={g,p}};
 /* crickets: a high tone chopped fast, then gated in slow pulses; two of them, slightly apart */
 const cricket=(f,r1,r2)=>dest=>{const o=c.createOscillator();o.frequency.value=f;const a=c.createGain(),b=c.createGain();a.gain.value=.5;b.gain.value=.5;
  const l1=c.createOscillator();l1.type='square';l1.frequency.value=r1;const g1=c.createGain();g1.gain.value=.5;l1.connect(g1);g1.connect(a.gain);const l2=c.createOscillator();l2.type='square';l2.frequency.value=r2;const g2=c.createGain();g2.gain.value=.5;l2.connect(g2);g2.connect(b.gain);
  o.connect(a);a.connect(b);b.connect(dest);o.start();l1.start();l2.start()};
 bed('crickets',d=>{cricket(4300,26,.9)(d);cricket(4650,23,.7)(d)},AMB.lpA);
 bed('leaves',loop([['bandpass',3200,.5],['highpass',1200]],[.13,.8]),AMB.lpA);
 bed('town',loop([['bandpass',420,.7],['lowpass',900]],[.21,.5],.9),AMB.lpA);
 bed('cave',d=>{loop([['lowpass',140]],[.05,.4],.5)(d);const o=c.createOscillator();o.frequency.value=49;const g=c.createGain();g.gain.value=.18;o.connect(g);g.connect(d);o.start()},AMB.amb);
 bed('room',loop([['lowpass',260],['highpass',40]],null,.6),AMB.amb);
 bed('stream',loop([['bandpass',1500,.9],['highpass',500]],[2.7,.4]));
 bed('falls',loop([['lowpass',1000],['highpass',90]],null,.8));
 bed('sea',loop([['lowpass',650],['highpass',60]],[.09,.8],.7));
 bed('pond',loop([['bandpass',520,1.4]],[.35,.6]));
 bed('fountain',loop([['bandpass',2400,.8]],[5.5,.3]));
 bed('fire',loop([['bandpass',3000,1.6]],[11,.9]));
 bed('lava',loop([['lowpass',260]],[.6,.7],.6));
 bed('rain',loop([['highpass',1700],['lowpass',7500]],null));
 bed('wind',loop([['bandpass',360,.6]],[.06,.85]));
 return true}
/* where a sound is, as a volume and a left-right pan, from where you stand and which way the camera faces */
function ambWhere(x,z,range){const P=DIO.pl,C=DIO.C;if(!P)return null;const d=Math.hypot(x-P.x,z-P.z);if(d>range)return null;const R=C&&C.right||[1,0,0],dx=(x-P.x)*R[0]+(z-P.z)*R[2];
 return {v:Math.pow(1-d/range,1.6),pan:clamp(dx/7,-1,1)*.75,d}}
function ambNearest(list,get,range){let best=null;for(const it of list||[]){const [x,z]=get(it);const w=ambWhere(x,z,range);if(w&&(!best||w.d<best.d))best=w}return best}
function ambUpdate(){if(!AUD.ctx||AUD.ctx.state!=='running')return;if(!AMB.bus&&!ambInit())return;const c=AUD.ctx,t=c.currentTime,T={};
 const walk=typeof DIO!=='undefined'&&DIO.ready&&DIO.sc&&!document.hidden&&typeof U!=='undefined'&&(U.tab==='walk'||(typeof B!=='undefined'&&B));
 const E=typeof ENV!=='undefined'&&ENV.on?ENV:null,sc=walk?DIO.sc:null;let pans={};
 if(sc){const put=(k,w,mul=1)=>{if(w&&w.v*mul>(T[k]||0)){T[k]=w.v*mul;pans[k]=w.pan}};
  put('stream',ambNearest(DGL.streamCells,q=>q,10),.5);
  put('falls',ambNearest(DGL.falls,q=>[q[0],q[2]],14),.7);
  if(sc.flatFar||sc.waterKind==='sea'||sc.far==='sea'){T.sea=.35;pans.sea=0;put('sea',ambNearest(DIO.water,q=>q,8),.6)}
  else put('pond',ambNearest(DIO.water,q=>q,6),.22);
  if(sc.waterKind==='lava')put('lava',ambNearest(DIO.water,q=>q,10),.5);
  const C0=dioData().sc,props=sc.props||[];
  put('fountain',ambNearest(props.filter(p=>/fountain/.test(p.k)),p=>[p.x,p.z],9),.45);
  put('fire',ambNearest(props.filter(p=>{const M=C0.props[p.k];return M&&(M.fx||[]).some(e=>e.k==='fire')}),p=>[p.x,p.z],7),.35);
  const thru=!sc.indoor?1:sc.roomRect?.45:0;if(E&&thru){T.rain=Math.min(1,E.rain)*.42*thru;T.wind=(E.storm*.4+(E.climate==='alpine'?.16:0)+E.snow*.1)*thru;pans.rain=pans.wind=0}
  /* thunder a moment after the flash */
  if(E&&E.flash>.9&&!AMB.flash){AMB.flash=1;const d=.5+Math.random()*1.6;audNoise(AMB.bus,{t:t+d,dur:2.6,vol:.55,lp:180});audNoise(AMB.bus,{t:t+d+.1,dur:1.2,vol:.25,lp:420})}else if(E&&E.flash<.5)AMB.flash=0}
 /* arriving somewhere: everything fades in */
 const sid=sc?dioBaseId():null;if(sid!==AMB.id){AMB.id=sid;AMB.arrive=t}ambApply();
 {const muf=!!(sc&&sc.roomRect);if(AMB.lpA){AMB.lpA.frequency.setTargetAtTime(muf?620:20000,t,.3);AMB.lpW.frequency.setTargetAtTime(muf?850:20000,t,.3)}}
 if(sc)ambLife(sc,E,T,pans,t);
 for(const [k,b] of Object.entries(AMB.beds)){b.g.gain.setTargetAtTime(T[k]||0,t,.35);if(b.p&&pans[k]!=null)b.p.pan.setTargetAtTime(pans[k],t,.25)}
 /* the music listens: drums soften when you stand still or at night, a pad at night, muffled in the rain */
 const night=E?(E.raw||E).night:0,moving=sc&&DIO.pl&&DIO.pl.walk;AUD.L={drums:(moving||(typeof B!=='undefined'&&B)?1:.45)*(1-night*.4),pad:sc&&!sc.indoor?night:0};
 if(AUD.song&&AUD.song.drums)AUD.song.drums.gain.setTargetAtTime(AUD.L.drums,t,.6);if(AUD.musLP)AUD.musLP.frequency.setTargetAtTime(E&&sc&&!sc.indoor&&E.rain>.3?2200:20000,t,.8)}
setInterval(()=>{try{ambUpdate()}catch(e){}},200);
/* the ambience: which beds play here, and the occasional bird, owl and clock tick */
function ambLife(sc,E,T,pans,t){const st=E||(typeof envState==='function'?envState(sc):{night:0,dusk:0}),night=st.night||0,day=1-night,rain=E?E.rain:0,dt=.2,ev=AMB.ev,room=!!sc.room,cave=sc.indoor&&sc.far==='cave',ss=st.season||st.ss;
 /* v47: a room laid into a place hears the place outside, quieter and through the walls (the low-pass in ambUpdate) */
 const thru=!sc.indoor?1:sc.roomRect?.45:0;
 const node=typeof ROUTE!=='undefined'&&typeof S!=='undefined'&&S.route?ROUTE[S.route.node]:null,town=thru>0&&!!(node&&node.town||(!sc.indoor&&(sc.far==='town'||sc.far==='city')));
 if(thru){const C0=dioData().sc,P=DIO.pl;let trees=0;for(const p of sc.props||[]){if(Math.abs(p.x-P.x)>9||Math.abs(p.z-P.z)>9)continue;const g=(C0.props[p.k]||{}).group||p.k;if(/tree|bush|hedge/.test(g))trees++}
  T.leaves=Math.min(1,trees/8)*.22*(.5+.5*(sc.wind||1))*(1+(E?E.storm:0)*.8)*thru;pans.leaves=0;
  T.crickets=night*(1-Math.min(1,rain))*(town?.05:.11)*(ss==='winter'?.2:1)*thru;pans.crickets=0;
  if(town){T.town=.13*(1-night*.6)*thru;pans.town=0}
  /* birds: a short call now and then by day, fewer in the rain; v47: the birds of the place (AMB_BIRDS) */
  {const L=AMB_BIRDS[sc.biome]||AMB_BIRDS._;if(L.length&&day>.3&&Math.random()<dt*(town?.12:.3)*day*(1-Math.min(1,rain)*.8)*thru){const k=L[Math.floor(Math.random()*L.length)];if(Math.random()<(AMB_RARE[k]||1))ambBird(t,k)}}
  /* the farm's rooster at first light */
  const hr=typeof envHour==='function'?envHour():12;if(sc.biome==='farm'&&hr>5&&hr<8.5&&Math.random()<dt*.03*thru)ambBird(t,'rooster');
  /* the scrap yard: metal shifting somewhere, the crane's cable creaking when nobody is looking */
  if(sc.biome==='bins'&&Math.random()<dt*.035*thru)ambClank(t);
  if(night>.6&&!town&&Math.random()<dt*.025*thru)ambOwl(t)}
 if(cave){T.cave=.3;pans.cave=0}
 if(room){T.room=.16;pans.room=0;if((sc.props||[]).some(p=>/clock/.test(p.k))){if(!ev.tick||ev.tick<t-1)ev.tick=t+.05;while(ev.tick<t+.25){ev.tock=!ev.tock;ambTick(ev.tick,ev.tock);ev.tick+=1}}}}
function ambOut(pan,dry){const c=AUD.ctx,g=c.createGain();let out=g;if(c.createStereoPanner){const p=c.createStereoPanner();p.pan.value=pan;g.connect(p);out=p}out.connect(dry?AMB.amb:AMB.lpA||AMB.amb);setTimeout(()=>{try{out.disconnect()}catch(e){}},4000);return g}
/* v47: the birds of each place (by the scene's biome): sparrows' chips and pigeons in town, larks over the open grass,
   thrushes in the woods, a reed warbler by the pond, gulls by the sea, crows on the scrap heaps, choughs and now and
   then a hawk in the mountains; "song" is a phrase of no bird in particular. AMB_RARE makes some of them rarer. */
const AMB_BIRDS={_:['song'],town:['sparrow','sparrow','pigeon','song'],food:['sparrow','pigeon','sparrow'],city:['pigeon','sparrow','pigeon'],grass:['lark','lark','song'],golf:['song','lark','thrush'],
 thicket:['thrush','song','woodpecker'],pond:['thrush','reed','song'],farm:['sparrow','song','thrush'],canyon:['hawk','song'],volcano:['hawk'],bins:['crow','crow','pigeon'],
 ridge:['chough','lark','hawk'],pass:['chough','hawk'],summit:['chough','sparrow'],sea:['gull'],island:['gull','gull','sparrow'],lake:['gull','reed','song'],grotto:[],mall:[],
 /* v47 part 4: the regions */meadow:['lark','lark','song'],blossom:['song','thrush','sparrow'],mangrove:['reed','song','gull'],vineyard:['lark','sparrow','song'],saltflat:['hawk'],
 badlands:['hawk','song'],spore:['song','thrush'],autumn:['thrush','woodpecker','song'],jungle:['song','woodpecker','thrush'],crystal:[],cavern:[],darkpool:[],tundra:['chough'],
 reef:['gull','gull'],harbour:['gull','gull','sparrow'],trench:['gull'],press:['gull'],silicon:['crow','sparrow'],park:['crow','pigeon','sparrow'],sky:['hawk'],desert:['hawk'],sun:[]};
const AMB_RARE={hawk:.3,woodpecker:.45,rooster:1};
function ambBird(t,kind){const g=ambOut((Math.random()-.5)*1.4),r=Math.random,V=o=>audVoice(g,o);g.gain.value=.5+r()*.5;
 if(kind==='sparrow'){const n=3+Math.floor(r()*5),f=3600+r()*700;let s=t;for(let i=0;i<n;i++){V({type:'sine',freq:f*(1+(r()-.5)*.08),t:s,dur:.035,vol:.04,a:.003,r:.02,slide:.7});s+=.07+r()*.09}return}
 if(kind==='lark'){const n=12+Math.floor(r()*12);let s=t;for(let i=0;i<n;i++){V({type:'sine',freq:2900+r()*2200,t:s,dur:.03+r()*.03,vol:.028,a:.003,r:.015,slide:.8+r()*.5});s+=.045+r()*.03}return}
 if(kind==='thrush'){const m=[1700+r()*500,2300+r()*500,1900+r()*400],rep=1+Math.floor(r()*2);let s=t;for(let k=0;k<rep;k++)for(const f of m){V({type:'sine',freq:f,t:s,dur:.11,vol:.035,a:.01,r:.04,slide:r()<.5?1.2:.85});s+=.15}return}
 if(kind==='reed'){const n=8+Math.floor(r()*8);let s=t;for(let i=0;i<n;i++){V({type:'triangle',freq:i%2?2400:1900,t:s,dur:.04,vol:.022,a:.004,r:.02,cut:5000});s+=.07}return}
 if(kind==='gull'){const n=2+Math.floor(r()*3);let s=t;for(let i=0;i<n;i++){V({type:'sawtooth',freq:1150+r()*150,t:s,dur:.22+r()*.08,vol:.018,a:.02,r:.06,slide:.55,cut:2400});s+=.32+r()*.1}return}
 if(kind==='crow'){const n=2+Math.floor(r()*2);let s=t;for(let i=0;i<n;i++){V({type:'sawtooth',freq:560+r()*60,t:s,dur:.2,vol:.028,a:.01,r:.05,slide:.82,cut:1500});audNoise(g,{t:s,dur:.18,vol:.02,bp:900,q:1.2});s+=.34+r()*.12}return}
 if(kind==='pigeon'){[[440,.22],[520,.3],[430,.26]].forEach(([f,d],i)=>V({type:'sine',freq:f,t:t+i*.3,dur:d,vol:.035,a:.04,r:.08,slide:.92,vib:2}));return}
 if(kind==='chough'){for(let i=0;i<2;i++)V({type:'triangle',freq:2700+r()*300,t:t+i*.3,dur:.16,vol:.024,a:.01,r:.04,slide:.65});return}
 if(kind==='hawk'){V({type:'sine',freq:3000,t,dur:.75,vol:.026,a:.03,r:.15,slide:.7,vib:1.5});return}
 if(kind==='woodpecker'){const n=12+Math.floor(r()*6);for(let i=0;i<n;i++)audNoise(g,{t:t+i*.055,dur:.03,vol:.07*(1-i/n*.5),bp:1100,q:3});return}
 if(kind==='rooster'){let s=t;[[620,.14],[880,.11],[980,.16],[820,.5]].forEach(([f,d],i)=>{V({type:'triangle',freq:f,t:s,dur:d,vol:.04,a:.01,r:.06,slide:i===3?.7:1.05,cut:3000});s+=d+.03});return}
 const base=2200+r()*1800,n=2+Math.floor(r()*4),kd=r();
 for(let i=0;i<n;i++){const s=t+i*(.09+r()*.06);V({type:'sine',freq:base*(kd<.5?1+(i%2)*.18:1.25-i*.06),t:s,dur:.06+r()*.05,vol:.035,a:.004,r:.03,slide:kd<.5?1.25:.8})}}
/* v47: the scrap yard: a sheet of metal shifting, or a slow creak of cable */
function ambClank(t){const g=ambOut((Math.random()-.5)*1.6);g.gain.value=.4+Math.random()*.4;
 if(Math.random()<.5){audNoise(g,{t,dur:.35,vol:.05,bp:700+Math.random()*500,q:6});audVoice(g,{type:'triangle',freq:180+Math.random()*80,t,dur:.4,vol:.02,a:.005,r:.2,slide:.9})}
 else audVoice(g,{type:'sawtooth',freq:95+Math.random()*30,t,dur:.9,vol:.012,a:.2,r:.3,slide:1.35,vib:3,cut:900})}
function ambOwl(t){const g=ambOut((Math.random()-.5)*1.2);[0,.42].forEach((d,i)=>audVoice(g,{type:'sine',freq:i?330:370,t:t+d,dur:i?.55:.3,vol:.045,a:.06,r:.18,vib:3}))}
function ambTick(t,tock){const g=ambOut(.15,true);audNoise(g,{t,dur:.018,vol:.05,bp:tock?2600:3400,q:4})}
/* Settings → Sound: hear each volume */
function audTest(k){audUnlock();setTimeout(()=>{if(!AUD.ctx||AUD.ctx.state!=='running')return;ambInit();AMB.arrive=-9;ambApply();const t=AUD.ctx.currentTime+.05;
 if(k==='music')jingle(JINGLES.levelup);else if(k==='sfx')sfx('coin');
 else if(k==='world'){audNoise(AMB.bus,{t,dur:1.2,vol:.35,bp:1500,q:.9});[0,.14].forEach(d=>audVoice(AMB.bus,{type:'square',freq:520,t:t+.5+d,dur:.09,vol:.05,slide:.7,cut:1600}))}
 else if(k==='amb'){ambBird(t);ambBird(t+.7)}},60)}
/* a one-off sound somewhere in the scene: animals calling, scurrying off, a frog's plop */
function sfxAt(name,x,z,o={}){if(!AUD.ctx||AUD.ctx.state!=='running'||typeof DIO==='undefined'||!DIO.ready)return;const w=ambWhere(x,z,14);if(!w||w.v<.03)return;const c=AUD.ctx,t=c.currentTime+.01,g=c.createGain();g.gain.value=w.v;
 if(name==='call'){if(t-AMB.lastCall<3)return;AMB.lastCall=t}let out=g;if(c.createStereoPanner){const p=c.createStereoPanner();p.pan.value=w.pan;g.connect(p);out=p}out.connect(AMB.bus||AUD.fx);const F=g;
 const k=o.k;
 if(name==='plop'){audVoice(F,{type:'sine',freq:900,t,dur:.08,vol:.12,slide:.35});audNoise(F,{t:t+.03,dur:.12,vol:.06,bp:1200,q:1})}
 else if(name==='rustle')audNoise(F,{t,dur:.18,vol:.035,bp:2600,q:.5});
 else if(name==='door'){audVoice(F,{type:'sawtooth',freq:170,t,dur:.24,vol:.018,slide:1.35});audNoise(F,{t:t+.24,dur:.06,vol:.06,lp:700})}/* v47: someone going in or out */
 else if(name==='scurry')audNoise(F,{t,dur:.25,vol:.06,bp:k==='crab'?3800:1800,q:.6});
 else if(name==='call'){
  if(k==='duck')[0,.14].forEach(d=>audVoice(F,{type:'square',freq:520,t:t+d,dur:.09,vol:.03,slide:.7,cut:1600}));
  else if(k==='pigeon')audVoice(F,{type:'sine',freq:330,t,dur:.35,vol:.05,vib:4});
  else if(k==='chicken')[0,.08,.16].forEach(d=>audVoice(F,{type:'p25',freq:700+Math.random()*80,t:t+d,dur:.05,vol:.03,slide:.8}));
  else if(k==='sheep'||k==='goat')audVoice(F,{type:'p25',freq:k==='goat'?520:380,t,dur:.45,vol:.04,vib:6,cut:1800});
  else if(k==='cat')audVoice(F,{type:'triangle',freq:650,t,dur:.35,vol:.05,slide:1.4,vib:2});
  else if(k==='gull')[0,.22].forEach(d=>audVoice(F,{type:'p12',freq:1100,t:t+d,dur:.18,vol:.035,slide:.6}));
  else if(k==='frog')[0,.12].forEach(d=>audVoice(F,{type:'square',freq:140,t:t+d,dur:.08,vol:.05,cut:700}));
  else if(k==='rabbit'||k==='squirrel')[0,.05,.1].forEach(d=>audVoice(F,{type:'p50',freq:2200,t:t+d,dur:.02,vol:.02}));
  else if(k==='crab')audNoise(F,{t,dur:.04,vol:.05,hp:5000});
  else if(k==='car')audVoice(F,{type:'p50',freq:420,t,dur:.25,vol:.03,cut:1200})}
 setTimeout(()=>{try{g.disconnect()}catch(e){}},2500)}
