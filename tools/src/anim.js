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
 shell(P,q){const k=P.k||0;return {head:{r:P.head*.6,dy:P.hdy-k*1.5},shell:{dy:Math.abs(Math.sin(P.t/500))*-.6,r:P.body*.3},body:{dx:-k*2,r:P.body*.5},armL:{r:P.aL*.7+Math.sin(P.t/300)*.08},armR:{r:P.aR*.5},foot:{sx:1+.03*Math.sin(P.t/600)},l1:{r:.15*Math.sin(P.t/200)},l2:{r:.15*Math.sin(P.t/200+2)},l3:{r:.12*Math.sin(P.t/200+4)},hover:{dx:P.hov.dx,dy:P.hov.dy,r:P.hov.r}}},
};
function animFor(plan,q){const f=ANIM[plan];return (P,back)=>f(P,q)}
