'use strict';
/* ================= BODY-PLAN ANIMATION (shared by the art tool and the game) =================
   Each function maps the shared pose channels P (from rigPose) to per-bone offsets for one body plan.
   q holds the few per-species numbers the motion needs (hover height, flap speed and so on). */
const OCTO_XS=[-.78,-.48,-.16,.16,.48,.78];
const ANIM={
 biped(P,q){const lift=q.lift||0,A={torso:{r:P.body,dy:P.bdy},head:{r:P.head,dx:P.hdx,dy:P.hdy},armL:{r:P.aL},armR:{r:P.aR},legL:{r:P.lL},legR:{r:P.lR},tail:{r:P.tail},hover:{dx:P.hov.dx,dy:P.hov.dy,r:P.hov.r},mane:{r:-P.head*.3}};
  const ph=P.t/(q.flapMs||300)*P.flap,fl=Math.sin(ph)*.32;A.wingL={r:.12+fl+P.k*.5};A.wingR={r:-.12-fl-P.k*.5};
  if(lift){A.fly={dy:Math.sin(ph)*1.4*(1-(P.fall||0))+(P.fall||0)*lift};A.legL.r+=.1*Math.sin(P.t/500);A.legR.r-=.1*Math.sin(P.t/500)}
  return A},
 quad(P,q){const w=Math.sin(P.t/700+P.seed)*.05,a=P.aL;
  const A={body:{r:P.body*.5,dy:P.bdy+(P.act==='attack'?-1.5*P.k:0)},head:{r:P.head-P.k*(P.act==='attack'?.28:0),dx:P.hdx,dy:P.hdy},tail:{r:P.tail*1.4},hover:{dx:P.hov.dx,dy:P.hov.dy,r:P.hov.r},mane:{r:-P.head*.3},
   legFN:{r:w+a*.32+P.lL*.4},legFF:{r:-w+a*.25},legBN:{r:-w-a*.2+P.lR*.4},legBF:{r:w-a*.15}};
  if(P.act==='cheer'||P.act==='buff')A.head.r-=.15*P.k;return A},
 flyer(P,q){const lift=q.lift,per=q.per,fall=P.fall||0,ph=P.t/per*Math.PI*(P.flap||1)*(1-fall*.9),fl=Math.sin(ph),amp=q.flapAmp||(per<100?.25:.45);
  return {fly:{dy:fl*(per<100?.5:1.8)*(1-fall)+fall*lift,r:P.body*.4},torso:{r:P.body*.5,dy:P.bdy},head:{r:P.head,dx:P.hdx,dy:P.hdy},neckS:{r:.05*Math.sin(P.t/700+P.seed)-P.k*.15},tail:{r:P.tail*.6},hover:{dx:P.hov.dx,dy:P.hov.dy,r:P.hov.r},
   wingL:{r:fl*amp+.1+P.k*.3-fall*.9},wingR:{r:-fl*amp-.1-P.k*.3+fall*.9},wing2L:{r:Math.sin(ph+.8)*amp*.8},wing2R:{r:-Math.sin(ph+.8)*amp*.8},
   legL:{r:.15*Math.sin(P.t/420)+P.aL*.3},legR:{r:-.15*Math.sin(P.t/420)},legM:{r:.1*Math.sin(P.t/380)},armL:{r:P.aL},armR:{r:P.aR}}},
 fish(P,q){const fall=P.fall||0,sw=Math.sin(P.t/420+P.seed);return {fly:{dy:sw*1.6*(1-fall)+fall*(q.lift+q.bh*.3),r:P.body*.5+fall*.4},torso:{r:.04*Math.sin(P.t/900)},tail:{r:sw*.25+P.tail*.4},wingL:{r:Math.sin(P.t/300)*.3+P.aL*.3},wingR:{r:-Math.sin(P.t/300)*.3},hover:{dx:P.hov.dx,dy:P.hov.dy,r:P.hov.r}}},
 serpent(P,q){const A={coil:{sy:1+.02*Math.sin(P.t/600)},head:{r:P.head-P.body*.6,dx:P.hdx,dy:P.hdy},hood:{sx:1+.08*P.k},tail:{r:.25*Math.sin(P.t/380+P.seed)+P.tail},hover:{dx:P.hov.dx,dy:P.hov.dy,r:P.hov.r}};
  for(let i=0;i<q.n;i++)A['n'+i]={r:.09*Math.sin(P.t/760+i*.95+P.seed)+(P.act==='attack'?(i<2?-.32:.12)*P.k:0)+P.body*.25-(P.fall||0)*(i===0?.9:.3)};return A},
 worm(P,q){const A={head:{r:P.head-P.k*.2,dx:P.hdx,dy:P.hdy},hover:{dx:P.hov.dx,dy:P.hov.dy,r:P.hov.r}};for(let i=0;i<q.n;i++)A['s'+i]={dy:-Math.abs(Math.sin(P.t/380-i*.8+P.seed))*1.6*(1-(P.fall||0)),sy:1+.04*Math.sin(P.t/380-i*.8)};return A},
 octo(P,q){const fall=P.fall||0,A={fly:{dy:Math.sin(P.t/520+P.seed)*1.5*(1-fall)+fall*q.tl*1.2,r:P.body*.4},head:{r:P.head*.5,dx:P.hdx,dy:P.hdy,sy:1+.03*Math.sin(P.t/520)},hover:{dx:P.hov.dx,dy:P.hov.dy,r:P.hov.r}};
  for(let i=0;i<6;i++)for(let j=0;j<3;j++){let r=Math.sin(P.t/640+i*1.7+j*.9+P.seed)*.2*(j+1)*.6*(1-fall*.7);if(i<=1)r+=(P.aL*(j===0?.35:.25))*(i===0?1:.6);if(i>=4)r+=P.aR*.25;if(fall)r+=(OCTO_XS[i]<0?-1:1)*fall*.5*(j===0?1:.3);A['t'+i+j]={r}}return A},
 blob(P,q){const w=Math.sin(P.t/420+P.seed)*.05,k=P.k||0,fall=P.fall||0;return {head:{sy:1+w+k*.08-fall*.35,sx:1-w*.8-k*.04+fall*.3,r:P.head*.4+P.body*.5},armL:{r:P.aL*.8},armR:{r:P.aR*.8},hover:{dx:P.hov.dx,dy:P.hov.dy,r:P.hov.r}}},
 /* v36c: more animal types for the new roster. Each names the pieces it moves; a piece named otherwise can take a
    role through its bone's "a" field in the Studio. */
 bird(P,q){const per=q.per||260,fl=Math.sin(P.t/per*Math.PI)*(.35+P.k*.4),hop=Math.abs(Math.sin(P.t/420+P.seed))*(q.hop||1.2);
  return {torso:{r:P.body*.6,dy:P.bdy-hop*.3},head:{r:P.head-P.k*.25,dx:P.hdx,dy:P.hdy-hop*.4},neck:{r:P.head*.5},tail:{r:P.tail*.8+fl*.15},wingL:{r:.15+fl+P.k*.6},wingR:{r:-.15-fl-P.k*.6},legL:{r:P.lL*.5+.06*Math.sin(P.t/500)},legR:{r:P.lR*.5-.06*Math.sin(P.t/500)},crest:{r:-P.head*.6-P.k*.3},hover:{dx:P.hov.dx,dy:P.hov.dy,r:P.hov.r}}},
 insect(P,q){const A={torso:{r:P.body*.4,dy:P.bdy},head:{r:P.head,dx:P.hdx,dy:P.hdy},abdomen:{r:-P.body*.3+.04*Math.sin(P.t/300)},antL:{r:.2*Math.sin(P.t/260+P.seed)+P.aL*.4},antR:{r:-.2*Math.sin(P.t/260+P.seed+1)+P.aR*.4},wingL:{r:.3*Math.sin(P.t/60)*(1+P.k)},wingR:{r:-.3*Math.sin(P.t/60)*(1+P.k)},hover:{dx:P.hov.dx,dy:P.hov.dy,r:P.hov.r}};
  for(let i=0;i<3;i++){A['legL'+i]={r:.12*Math.sin(P.t/220+i*2.1)+P.lL*.3};A['legR'+i]={r:-.12*Math.sin(P.t/220+i*2.1+1)+P.lR*.3}}return A},
 crab(P,q){const sc=.08*Math.sin(P.t/180+P.seed);const A={torso:{dx:sc*4,r:P.body*.3,dy:P.bdy},head:{r:P.head*.5,dx:P.hdx,dy:P.hdy},clawL:{r:-.3+P.aL*1.2-P.k*.8},clawR:{r:.3+P.aR*1.2+P.k*.8},eyeL:{r:.1*Math.sin(P.t/500)},eyeR:{r:-.1*Math.sin(P.t/500)},hover:{dx:P.hov.dx,dy:P.hov.dy,r:P.hov.r}};
  for(let i=0;i<4;i++){A['legL'+i]={r:.15*Math.sin(P.t/200+i*1.6)};A['legR'+i]={r:-.15*Math.sin(P.t/200+i*1.6+.8)}}return A},
 hopper(P,q){const b=Math.abs(Math.sin(P.t/560+P.seed)),crouch=(P.act==='attack'||P.act==='cheer')?P.k:0;
  return {torso:{r:P.body*.6-crouch*.15,dy:P.bdy+crouch*2,sy:1-crouch*.12,sx:1+crouch*.08},head:{r:P.head,dx:P.hdx,dy:P.hdy},earL:{r:-.15*b-P.k*.5},earR:{r:.15*b+P.k*.5},armL:{r:P.aL},armR:{r:P.aR},thighL:{r:.1*b+crouch*.6},thighR:{r:-.1*b+crouch*.6},footL:{r:-crouch*.4},footR:{r:-crouch*.4},tail:{r:P.tail},hover:{dx:P.hov.dx,dy:P.hov.dy,r:P.hov.r}}},
 plant(P,q){const w=Math.sin(P.t/900+P.seed);const A={torso:{r:.04*w+P.body*.3,sy:P.sy},head:{r:P.head*.6+.05*w,dx:P.hdx,dy:P.hdy},pot:{},hover:{dx:P.hov.dx,dy:P.hov.dy,r:P.hov.r}};
  for(let i=0;i<4;i++){A['leafL'+i]={r:-.1+.08*Math.sin(P.t/700+i)+P.aL*.5*(i===0)};A['leafR'+i]={r:.1-.08*Math.sin(P.t/700+i+1)+P.aR*.5*(i===0)}}return A},
 shell(P,q){const k=P.k||0;return {head:{r:P.head*.6,dy:P.hdy-k*1.5},shell:{dy:Math.abs(Math.sin(P.t/500))*-.6,r:P.body*.3},body:{dx:-k*2,r:P.body*.5},armL:{r:P.aL*.7+Math.sin(P.t/300)*.08},armR:{r:P.aR*.5},foot:{sx:1+.03*Math.sin(P.t/600)},l1:{r:.15*Math.sin(P.t/200)},l2:{r:.15*Math.sin(P.t/200+2)},l3:{r:.12*Math.sin(P.t/200+4)},hover:{dx:P.hov.dx,dy:P.hov.dy,r:P.hov.r}}},
};
/* v34: the walk per body plan, seen from the front or the back (no side views): two-legged ones lift a foot at a
   time, four-legged ones move their legs in diagonal pairs, fliers flap harder, fish swish, snakes and worms ripple,
   octopuses stride on their tentacles, blobs bounce, shelled ones scuttle */
const WALK={
 biped(A,P){const s=Math.sin(P.wk),u=Math.max(0,s),d=Math.max(0,-s);A.legL=Object.assign(A.legL||{},{dy:-u*2.6,r:(A.legL&&A.legL.r||0)+.07*s});A.legR=Object.assign(A.legR||{},{dy:-d*2.6,r:(A.legR&&A.legR.r||0)-.07*s});if(A.torso)A.torso.dy=(A.torso.dy||0)+Math.abs(s)*.6},
 quad(A,P){const s=Math.sin(P.wk),u=Math.max(0,s)*2.2,d=Math.max(0,-s)*2.2;for(const [k,v] of [['legFN',u],['legBF',u],['legFF',d],['legBN',d]])A[k]=Object.assign(A[k]||{},{dy:-v});if(A.head)A.head.dy=(A.head.dy||0)+Math.abs(s)*.8},
 flyer(A,P){if(A.fly)A.fly.dy=(A.fly.dy||0)+Math.sin(P.wk*2)*1.2},
 fish(A,P){if(A.tail)A.tail.r=(A.tail.r||0)+Math.sin(P.wk*1.5)*.3;if(A.fly)A.fly.r=(A.fly.r||0)+Math.sin(P.wk)*.08},
 serpent(A,P,q){for(let i=0;i<q.n;i++){const k='n'+i;A[k]=A[k]||{};A[k].r=(A[k].r||0)+.14*Math.sin(P.wk*1.2-i*1.1)}},
 worm(A,P,q){for(let i=0;i<q.n;i++){const k='s'+i;A[k]=A[k]||{};A[k].dy=(A[k].dy||0)-Math.max(0,Math.sin(P.wk-i*.9))*2.2}},
 octo(A,P){for(let i=0;i<6;i++){const k='t'+i+'0';A[k]=A[k]||{};A[k].r=(A[k].r||0)+(i%2?1:-1)*.22*Math.sin(P.wk)}if(A.fly)A.fly.dy=(A.fly.dy||0)-Math.abs(Math.sin(P.wk))*1.5},
 blob(A,P){const b=Math.abs(Math.sin(P.wk));if(A.head){A.head.sy=(A.head.sy||1)*(1-.1*(1-b));A.head.sx=(A.head.sx||1)*(1+.08*(1-b))}},
 bird(A,P){const s=Math.sin(P.wk);A.legL=Object.assign(A.legL||{},{dy:-Math.max(0,s)*2.2});A.legR=Object.assign(A.legR||{},{dy:-Math.max(0,-s)*2.2});if(A.head)A.head.dy=(A.head.dy||0)+Math.abs(s)*1.2},
 insect(A,P){for(let i=0;i<3;i++){const s=Math.sin(P.wk+i*2.1);A['legL'+i]=Object.assign(A['legL'+i]||{},{dy:-Math.max(0,s)*1.5});A['legR'+i]=Object.assign(A['legR'+i]||{},{dy:-Math.max(0,-s)*1.5})}},
 crab(A,P){for(let i=0;i<4;i++){const s=Math.sin(P.wk*2+i*1.6);A['legL'+i]=Object.assign(A['legL'+i]||{},{dy:-Math.max(0,s)*1.4});A['legR'+i]=Object.assign(A['legR'+i]||{},{dy:-Math.max(0,-s)*1.4})}if(A.torso)A.torso.dx=(A.torso.dx||0)+Math.sin(P.wk)*1.5},
 hopper(A,P){const b=Math.max(0,Math.sin(P.wk));if(A.torso){A.torso.dy=(A.torso.dy||0)-b*3;A.torso.sy=(A.torso.sy||1)*(1+b*.06)}for(const k of ['thighL','thighR']){A[k]=A[k]||{};A[k].r=(A[k].r||0)+b*.5}},
 plant(A,P){if(A.torso)A.torso.r=(A.torso.r||0)+.05*Math.sin(P.wk)},
 shell(A,P){for(const [k,o] of [['l1',0],['l2',2],['l3',4]]){A[k]=A[k]||{};A[k].r=.3*Math.sin(P.wk*2+o)}if(A.shell)A.shell.dy=(A.shell.dy||0)-Math.abs(Math.sin(P.wk*2))*.8}};
function animFor(plan,q){const f=ANIM[plan],w=WALK[plan];return (P,back)=>{const A=f(P,q);if(w&&P.wk!=null)w(A,P,q);return A}}
