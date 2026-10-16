/* ================= BODY PLANS: biped, quad, flyer, fish, serpent, worm, octo, blob, shell ================= */
const RIGBOX={w:112,h:104};
function dims(o,def,s){const r=Object.assign({},def,o||{});['w','h','len','r','span','lift'].forEach(k=>{if(typeof r[k]==='number')r[k]*=s});return r}
function faceVariants(H,C,M){const o={};['idle','blink','hurt','shout','happy'].forEach(v=>o[v]=A=>faceDeco(A,H,C,M,v));return o}
const ACCAN={hat:[.5,1],hover:[.5,1],hand:[.5,.3],face:[.5,.5],back:[.5,.92],mouth:[.12,.5],talon:[.5,.12],neck:[.5,.15]};
function accBones(D,k,ctx){const out=[];(D.acc||[]).forEach(([key,place,o],i)=>{o=o||{};const P=ctx[place]||ctx.hover;if(!P)return;
  let img;if(PROPS[key])img=bake(PROPS[key](o),k);else if(ICONS[key]){const c=iconCanvas(key,(o.s||1)*k),an=ACCAN[place]||[.5,.5];img={c,ox:-Math.round(c.width*an[0]),oy:-Math.round(c.height*an[1])}}else return;
  out.push({n:place==='hover'?'hover':'acc'+i,par:P.par,at:[P.at[0]+(o.dx||0),P.at[1]+(o.dy||0)],rr:o.r||0,img,z:P.z+(o.z||0),zb:P.zb+(o.zb||0),hideB:P.hideB})});return out}
function finishRig(R,k,top,hw,lift){R.k=k;R.anim=animFor(R.plan,R.q);R.BW=Math.round(RIGBOX.w*k);R.BH=Math.round(RIGBOX.h*k);R.cx=Math.round(R.BW/2);R.base=R.BH-Math.round(4*k);
 R.geo={cx:R.cx,base:R.base,top:R.base+top*k,mid:R.base+(top*k)/2,hw:hw*k,lift:(lift||0)*k,k,cy:R.base+((top-lift)/2-lift/2)*k};R.geo.mid=R.base+((top+(-(lift||0)))/2)*k;return R}
/* ---------- BIPED ---------- */
function buildBiped(D,k){const s=D.sz||1,C=D.c,O=D.outfit||{};
 const H=dims(D.head,{w:16,h:14},s),B=dims(D.body,{w:11,h:10,shape:'pear'},s),Ar=dims(D.arm,{len:11,r:3.2,hand:'paw'},s),Lg=dims(D.leg,{len:8,r:3.8,foot:'paw'},s),lift=(D.lift||0)*s;
 const footH=Lg.r*.85,hipY=-(Lg.len+footH),bones=[];
 if(lift)bones.push({n:'fly',at:[0,-lift]});const F=lift?'fly':'root';
 bones.push({n:'legR',par:F,at:[B.w*.42,hipY],img:bake(legPart(Lg,C,O,'far'),k),z:1,zb:2},{n:'legL',par:F,at:[-B.w*.42,hipY],img:bake(legPart(Lg,C,O,'near'),k),z:2,zb:1});
 const tY=hipY+Lg.r*.7;bones.push({n:'torso',par:F,at:[0,tY],img:bake(torsoPart(B,C,O,false),k),imgB:bake(torsoPart(B,C,O,true),k),z:4,zb:4});
 const sh=[B.w*(D.shX||.86),-2*B.h*(D.shY||.8)];
 bones.push({n:'armR',par:'torso',at:[sh[0],sh[1]],rr:-.22,img:bake(armPart(Ar,C,O,'far'),k),z:1.5,zb:3});
 bones.push({n:'armL',par:'torso',at:[-sh[0],sh[1]],rr:.22,img:bake(armPart(Ar,C,O,'near'),k),z:6,zb:3.1});
 if(D.tail){const T=dims(D.tail,{len:12},s);bones.push({n:'tail',par:'torso',at:[B.w*(T.x||.7),-B.h*(T.y||.4)],rr:T.rr||0,img:bake(tailPart(T,C),k),z:0,zb:9})}
 if(D.wings){const Wd=dims(D.wings,{span:20},s);bones.push({n:'wingL',par:'torso',at:[-B.w*.32,-2*B.h*.8],img:bake(wingPart(Wd,C,1),k),z:.5,zb:8.5},{n:'wingR',par:'torso',at:[B.w*.32,-2*B.h*.8],img:bake(wingPart(Object.assign({},Wd,{far:1}),C,-1),k),z:.4,zb:8.4})}
 const hp=headPart(H,C,false),hb=headPart(H,C,true),M=hp.M;
 const neck=[D.neckX!=null?D.neckX*s:-B.w*.06,-2*B.h+B.h*(D.neck==null?.32:D.neck)];
 bones.push({n:'head',par:'torso',at:neck,img:bake(hp.pt,k,faceVariants(H,C,M)),imgB:bake(hb.pt,k),z:7,zb:7,face:1});
 if(H.hair&&H.hair.long)bones.push({n:'hairB',par:'head',at:[0,0],img:bake(hairBack(H,C,M),k),z:3.5,zb:7.5});
 if(D.mane)bones.push({n:'mane',par:'head',at:[0,M.hc+M.hh*.1],img:bake(manePart(dims(D.mane,{r:M.hw*1.45},1),C),k),z:6.8,zb:7.6});
 const top=tY+neck[1]+M.hc-M.hh-(H.ears&&H.ears.k==='long'?M.hh*1.6:H.ears&&H.ears.k?M.hh*.5:0)-lift;
 const ctx={hat:{par:'head',at:[M.fx*.5+(D.hatX||0)*s,M.hc-M.hh*(D.hatY||.8)],z:8,zb:8},face:{par:'head',at:[M.fx,M.ey],z:8,zb:-1,hideB:1},hand:{par:'armL',at:[-Ar.r*.1,Ar.len+Ar.r*.5],z:6.5,zb:2.5},
  hover:{par:'root',at:[D.hovX||0,top-6],z:9,zb:9},back:{par:'torso',at:[B.w*.35,-2*B.h*.62],z:.2,zb:8.6},neck:{par:'torso',at:[neck[0],neck[1]+1],z:7.5,zb:3},pouch:{par:'torso',at:[-B.w*.18,-B.h*.62],z:4.5,zb:3}};
 bones.push(...accBones(D,k,ctx));
 const R={bones,plan:'biped',q:{lift,flapMs:D.flapMs||300}};return finishRig(R,k,top,Math.max(B.w,M.hw),lift)}
function manePart(Mn,C){const r=Mn.r,n=Mn.n||11,pts=[];for(let i=0;i<n*2;i++){const a=i/(n*2)*Math.PI*2,rr=i&1?r*.72:r;pts.push([Math.cos(a)*rr,Math.sin(a)*rr*.95-r*.15])}
 const f=sP(pts,1.5);return {bb:[-r*1.2,-r*1.3,r*1.2,r*1.1],th:r*.4,g:[[f]],mat:Mat(Mn.c||C.hair||'#C8742A',{c2:Mn.c2||C.hair2,rad:Mn.c2||C.hair2?[0,-r*.15,r]:null,hi:.6}),l:[{f:(x,y)=>Math.sin(Math.atan2(y,x)*n)*2-.6,a:.25}],ao:.05}}
function hairBack(H,C,M){const HR=H.hair,hw=M.hw,hh=M.hh,s=M.fx*.4,L=HR.long===2?1.5:1,f=sUnion(sE(s,M.hc+hh*.3,hw*1.04,hh*1.02),sE(s,M.hc+hh*(.9+.3*L),hw*.86,hh*.5*L));
 return {bb:[-hw*1.7,M.hc-hh*1.3,hw*1.7,M.hc+hh*2.4],th:hw*.35,g:[[f]],mat:Mat(HR.c,{c2:HR.c2,grad:HR.c2?[0,M.hc-hh,0,M.hc+hh*1.8]:null,hi:.6}),l:[{f:(x,y)=>Math.sin(x*1.1+Math.sin(y*.35)*1.5)*1.3-.85,a:.22}],ao:.08}}
/* ---------- QUADRUPED (3/4 profile, facing left) ---------- */
function quadBodyPart(Bd,C,O,back){const bw=Bd.w,bh=Bd.h,g=[[sE(0,0,bw,bh)],[sE(-bw*.4,-bh*.06,bw*.6,bh*1.06),'s',bh*.6]],p=[],l=[];
 const fur=Mat(C.fur,C.fur2?{c2:C.fur2,grad:[-bw,0,bw,0],hi:C.hi}:{hi:C.hi,pat:Bd.pat?PATS[Bd.pat](C,Bd):null});
 if(C.belly&&Bd.belly!==false)p.push({f:sE(-bw*.25,bh*.62,bw*.78,bh*.42),m:Mat(C.belly),soft:.8});
 if(Bd.hump)g.push([sE(bw*.05,-bh*.7,bw*.6,bh*.55),'s',bh*.5]);
 if(O&&O.k){const tp=torsoPart({w:bw*.55,h:bh*.75,shape:'round'},C,O,back);p.push(...(tp.p||[]).map(q=>({f:(x,y)=>Math.max(q.f(x+bw*.42,y+bh*.75*2-bh*.6),sE(-bw*.4,-bh*.06,bw*.58,bh*1.0)(x,y)),m:q.m,soft:q.soft,bk:q.bk})))}
 return {bb:[-bw*1.3,-bh*1.5,bw*1.3,bh*1.3],th:bh*.95,g,mat:fur,p,l,back,ao:.12}}
function buildQuad(D,k){const s=D.sz||1,C=D.c,O=D.outfit||{};
 const H=dims(D.head,{w:13,h:11,turn:1.7},s),Bd=dims(D.body,{w:17,h:9},s),Lg=dims(D.leg,{len:7,r:3.2,foot:'paw'},s);
 const footH=Lg.r*.85,legTop=-(Lg.len+footH),bodyY=legTop-Bd.h*.3,bones=[];
 bones.push({n:'body',at:[0,bodyY],img:bake(quadBodyPart(Bd,C,O,false),k),imgB:bake(quadBodyPart(Bd,C,O,true),k),z:4,zb:4});
 const LF=bake(legPart(Lg,C,{},'far'),k),LN=bake(legPart(Lg,C,{},'near'),k);
 bones.push({n:'legFF',par:'body',at:[-Bd.w*.32,Bd.h*.18],img:LF,z:1,zb:1},{n:'legBF',par:'body',at:[Bd.w*.68,Bd.h*.18],img:LF,z:1,zb:1},
  {n:'legFN',par:'body',at:[-Bd.w*.58,Bd.h*.3],img:LN,z:5,zb:5},{n:'legBN',par:'body',at:[Bd.w*.48,Bd.h*.3],img:LN,z:5,zb:5});
 if(D.tail){const T=dims(D.tail,{len:12},s);bones.push({n:'tail',par:'body',at:[Bd.w*.92,-Bd.h*(T.y||.25)],rr:T.rr||0,img:bake(tailPart(T,C),k),z:0,zb:9})}
 if(D.shell){const S=dims(D.shell,{w:Bd.w*1.02/s,h:Bd.h*1.1/s},s);bones.push({n:'shell',par:'body',at:[Bd.w*.06,-Bd.h*.12],img:bake(SHELLS[S.k](S,C,false),k),z:6,zb:6})}
 const hp=headPart(H,C,false),hb=headPart(H,C,true),M=hp.M;
 const hx=-Bd.w*(D.headX||.86),hy=-Bd.h*(D.headY||.42)-(D.neckLen||0)*s;
 if(D.neckLen){const nl=D.neckLen*s,nr=(D.neckR||4)*s;bones.push({n:'neck',par:'body',at:[-Bd.w*.62,-Bd.h*.35],img:bake({bb:[-nr*3,-nl*1.5,nr*3,nr*2],th:nr,g:[[sC(0,0,hx+Bd.w*.62,hy+Bd.h*.35+nr,nr*1.2,nr)]],mat:Mat(C.fur,{hi:C.hi}),p:D.neckMane?[{f:(x,y)=>x-(-nr*.1),m:Mat(C.hair||C.fur)}]:[]},k),z:6,zb:6})}
 bones.push({n:'head',par:'body',at:[hx,hy],img:bake(hp.pt,k,faceVariants(H,C,M)),imgB:bake(hb.pt,k),z:7,zb:7,face:1});
 if(D.mane)bones.push({n:'mane',par:'head',at:[M.hw*.15,M.hc+M.hh*.15],img:bake(manePart(dims(D.mane,{r:M.hw*1.4},1),C),k),z:6.8,zb:7.6});
 const top=bodyY+Math.min(hy+M.hc-M.hh-(H.ears&&H.ears.k?M.hh*.5:0)-(H.horn&&H.horn.k?M.hh*.9:0),-Bd.h*1.1);
 const ctx={hat:{par:'head',at:[M.fx*.5+(D.hatX||0)*s,M.hc-M.hh*(D.hatY||.8)],z:8,zb:8},face:{par:'head',at:[M.fx,M.ey],z:8,zb:-1,hideB:1},mouth:{par:'head',at:M.mouth?[M.mouth[0]-M.hw*.15,M.mouth[1]]:[M.fx-M.hw*.6,M.hc+M.hh*.4],z:8,zb:8},
  hand:{par:'head',at:M.mouth?[M.mouth[0]-M.hw*.15,M.mouth[1]]:[M.fx-M.hw*.6,M.hc+M.hh*.4],z:8,zb:8},hover:{par:'root',at:[0,top-6],z:9,zb:9},back:{par:'body',at:[Bd.w*(D.backX||.1),-Bd.h*.82],z:6.5,zb:6.5},neck:{par:'head',at:[0,-1],z:7.5,zb:6}};
 bones.push(...accBones(D,k,ctx));
 const R={bones,plan:'quad',tipX:Bd.w*.9,q:{}};return finishRig(R,k,top,Bd.w*1.3,0)}
/* ---------- FLYER (bird / insect / moth / ptero) ---------- */
function buildFlyer(D,k){const s=D.sz||1,C=D.c,O=D.outfit||{},kind=D.kind||'bird';
 if(kind==='fish'||kind==='whale'||kind==='puffer')return buildFish(D,k);
 const H=dims(D.head,{w:13,h:12},s),B=dims(D.body,{w:10,h:10,shape:kind==='insect'?'insect':'egg'},s),lift=(D.lift==null?16:D.lift)*s,bones=[{n:'fly',at:[0,-lift]}];
 if(D.leg){const Lg=dims(D.leg,{len:6,r:2.4,foot:'talon',thin:1},s),L1=bake(legPart(Lg,C,{},'near'),k),L2=bake(legPart(Lg,C,{},'far'),k);bones.push({n:'legR',par:'fly',at:[B.w*.35,-B.h*.25],img:L2,z:1,zb:1},{n:'legL',par:'fly',at:[-B.w*.3,-B.h*.2],img:L1,z:2,zb:2});
  if(kind==='insect')bones.push({n:'legM',par:'fly',at:[B.w*.05,-B.h*.25],img:L2,z:1.2,zb:1.2,rr:-.2})}
 bones.push({n:'torso',par:'fly',at:[0,0],img:bake(torsoPart(B,C,O,false),k),imgB:bake(torsoPart(B,C,O,true),k),z:4,zb:4});
 const Wd=dims(D.wings,{span:22,k:'bird'},s),wy=-2*B.h*(D.wingY||.72);
 bones.push({n:'wingL',par:'torso',at:[-B.w*.4,wy],img:bake(wingPart(Wd,C,1,false),k),z:kind==='insect'||kind==='moth'?.5:.5,zb:8},{n:'wingR',par:'torso',at:[B.w*.4,wy],img:bake(wingPart(Object.assign({},Wd,{far:1}),C,-1,false),k),z:.4,zb:8});
 if(D.wings2){const W2=dims(D.wings2,{span:16},s);bones.push({n:'wing2L',par:'torso',at:[-B.w*.3,wy+B.h*.5],img:bake(wingPart(W2,C,1),k),z:.3,zb:7.9},{n:'wing2R',par:'torso',at:[B.w*.3,wy+B.h*.5],img:bake(wingPart(Object.assign({},W2,{far:1}),C,-1),k),z:.2,zb:7.9})}
 if(D.tail){const T=dims(D.tail,{len:12},s);bones.push({n:'tail',par:'torso',at:[B.w*(T.x||.55),-B.h*(T.y||.35)],rr:T.rr==null?.5:T.rr,img:bake(tailPart(T,C),k),z:0,zb:9})}
 if(D.arm){const Ar=dims(D.arm,{len:7,r:2.2,hand:'paw'},s);bones.push({n:'armR',par:'torso',at:[B.w*.7,-2*B.h*.68],rr:-.3,img:bake(armPart(Ar,C,O,'far'),k),z:1.5,zb:3},{n:'armL',par:'torso',at:[-B.w*.7,-2*B.h*.68],rr:.3,img:bake(armPart(Ar,C,O,'near'),k),z:6,zb:3});D._ar=Ar}
 const hp=headPart(H,C,false),hb=headPart(H,C,true),M=hp.M,neck=[(D.neckX||-.1)*B.w,-2*B.h+B.h*(D.neck==null?.3:D.neck)];let hpar='torso',hat=neck,nl=0;
 if(D.neckLen){nl=D.neckLen*s;const nr=(D.neckR||3)*s,f=sCurve([0,nr*.5],[nl*.55,-nl*.45],[-nl*.15,-nl],nr*1.15,nr*.9);bones.push({n:'neckS',par:'torso',at:neck,img:bake({bb:[-nl,-nl*1.3,nl*1.2,nr*3],th:nr,g:[[f]],mat:Mat(C.fur,{hi:.6,c2:C.fur2,grad:C.fur2?[0,0,0,-nl]:null}),p:C.belly?[{f:(x,y)=>x-(-nl*.15+(y+nl)*.25)+nr*.3,m:Mat(C.belly),soft:1}]:[]},k),z:6,zb:6});hpar='neckS';hat=[-nl*.15,-nl+nr*.5]}
 bones.push({n:'head',par:hpar,at:hat,img:bake(hp.pt,k,faceVariants(H,C,M)),imgB:bake(hb.pt,k),z:7,zb:7,face:1});
 if(H.hair&&H.hair.long)bones.push({n:'hairB',par:'head',at:[0,0],img:bake(hairBack(H,C,M),k),z:3.5,zb:7.5});
 const top=-lift-2*B.h+neck[1]-nl+B.h*2+M.hc-M.hh-(H.horn&&H.horn.k?M.hh:0)-(H.hair&&H.hair.k?M.hh*.4:0);
 const hand=D._ar?{par:'armL',at:[0,D._ar.len+D._ar.r*.4],z:6.5,zb:2.5}:D.leg?{par:'legL',at:[-1,(D.leg.len||6)*s+2],z:2.5,zb:2.5}:{par:'head',at:M.mouth||[M.fx-M.hw*.7,M.hc+M.hh*.35],z:8,zb:8};
 const ctx={hat:{par:'head',at:[M.fx*.5+(D.hatX||0)*s,M.hc-M.hh*(D.hatY||.8)],z:8,zb:8},face:{par:'head',at:[M.fx,M.ey],z:8,zb:-1,hideB:1},hand,talon:D.leg?{par:'legL',at:[-1,(D.leg.len||6)*s+2.5],z:2.5,zb:2.5}:hand,
  mouth:{par:'head',at:M.mouth||[M.fx-M.hw*.8,M.hc+M.hh*.3],z:8,zb:8},hover:{par:'root',at:[0,top-6],z:9,zb:9},back:{par:'torso',at:[B.w*.2,-2*B.h*.7],z:.6,zb:8.6},neck:{par:'torso',at:[neck[0],neck[1]+1],z:7.5,zb:3}};
 bones.push(...accBones(D,k,ctx));
 const per={insect:55,moth:520,bird:300,ptero:420,bat:380}[kind]||300;
 const R={bones,plan:'flyer',q:{lift,per,flapAmp:D.flapAmp||0}};return finishRig(R,k,top,Math.max(Wd.span*.9,B.w),lift)}
/* ---------- FISH (shark / whale / puffer) ---------- */
function buildFish(D,k){const s=D.sz||1,C=D.c,kind=D.kind,bw=(D.body&&D.body.w||20)*s,bh=(D.body&&D.body.h||9)*s,lift=(D.lift==null?18:D.lift)*s,bones=[{n:'fly',at:[0,-lift-bh]}];
 const g=[],p=[],l=[];const fur=Mat(C.fur,{c2:C.fur2,grad:C.fur2?[0,-bh,0,bh]:null,hi:.55,pat:D.pat?PATS[D.pat](C,D):null});
 if(kind==='puffer'){g.push([sE(0,0,bw,bh)]);const sp=[];for(let i=0;i<14;i++){const a=i/14*Math.PI*2,r1=Math.min(bw,bh)*.98;sp.push(sP([[Math.cos(a-.12)*r1,Math.sin(a-.12)*r1*bh/bw*1.0],[Math.cos(a)*r1*1.28,Math.sin(a)*r1*1.28*bh/bw],[Math.cos(a+.12)*r1,Math.sin(a+.12)*r1*bh/bw]],.4))}g.push([sUnion(...sp),'u']);
  p.push({f:sE(-bw*.1,bh*.5,bw*.75,bh*.5),m:Mat(C.belly||'#F4F2EC'),soft:1})}
 else{g.push([sE(0,0,bw,bh)]);g.push([sE(bw*.55,bh*.05,bw*.55,bh*.55),'s',bh*.5]);if(kind==='fish')g.push([sP([[-bw*.6,-bh*.55],[-bw*1.22,bh*.05],[-bw*.6,bh*.6]],2),'s',bh*.6]);
  p.push({f:(x,y)=>(bh*.18+(x+bw)*.05)-y,m:Mat(C.belly||'#F4F2EC'),soft:1.2});
  if(kind==='whale')l.push({f:(x,y)=>y>bh*.25?Math.sin(y*1.3)*1.2-.6:9,a:.35});
  const dor=sP(kind==='whale'?[[bw*.15,-bh*.85],[bw*.45,-bh*1.25],[bw*.55,-bh*.75]]:[[-bw*.15,-bh*.9],[bw*.2,-bh*1.75],[bw*.4,-bh*.8]],1);g.push([dor,'s',1.5])}
 if(kind==='fish')l.push({f:sUnion(...[0,1,2].map(i=>sC(-bw*.3+i*2.2,-bh*.3,-bw*.38+i*2.2,bh*.3,.3))),a:.45});
 const H={w:bw*.55,h:bh*.9,eyes:D.eyes||{k:'big',s:kind==='whale'?.7:1},mouth:D.mouth||(kind==='fish'?'grin':'smile'),glasses:D.glasses,brow:D.brow,blush:D.blush,noNose:1,mw:kind==='fish'?.55:.4};
 const M={hw:H.w,hh:H.h,hc:0,fx:-bw*.45,ey:-bh*.18,eL:[-bw*.78,-bh*.22],eR:[-bw*.42,-bh*.2],erx:bh*.16*(H.eyes.s||1),ery:bh*.22*(H.eyes.s||1),mouth:[-bw*.62,bh*.34]};
 if(kind==='puffer'){M.eL=[-bw*.52,-bh*.12];M.eR=[-bw*.02,-bh*.1];M.erx=bw*.16;M.ery=bh*.24;M.mouth=[-bw*.36,bh*.38]}
 const body={bb:[-bw*1.5,-bh*2,bw*1.6,bh*1.6],th:bh*.9,g,mat:fur,p,l,ao:.12};
 bones.push({n:'torso',par:'fly',at:[0,0],img:bake(body,k,faceVariants(H,C,M)),imgB:bake(Object.assign({},body,{back:true}),k),z:4,zb:4,face:1});
 const T=dims(D.tail,{k:kind==='whale'?'fluke':'fin',len:kind==='puffer'?8:14},s);bones.push({n:'tail',par:'torso',at:[bw*(kind==='puffer'?.9:1.02),0],img:bake(tailPart(T,C),k),z:3,zb:3});
 const Wd=dims(D.wings,{k:'fin',span:kind==='puffer'?8:11,c:C.fin||C.fur},s);bones.push({n:'wingL',par:'torso',at:[-bw*.25,bh*.35],img:bake(wingPart(Wd,C,1),k),z:5,zb:5},{n:'wingR',par:'torso',at:[bw*.05,bh*.1],img:bake(wingPart(Object.assign({},Wd,{far:1}),C,-1),k),z:1,zb:1});
 const top=-lift-bh*2.2;
 const ctx={hat:{par:'torso',at:[-bw*.35+(D.hatX||0)*s,-bh*(D.hatY||.85)],z:8,zb:8},face:{par:'torso',at:[(M.eL[0]+M.eR[0])/2,M.ey],z:8,zb:-1,hideB:1},hand:{par:'wingL',at:[-Wd.span*.6,Wd.span*.3],z:6,zb:6},mouth:{par:'torso',at:M.mouth,z:8,zb:8},hover:{par:'root',at:[0,top-4],z:9,zb:9},back:{par:'torso',at:[bw*.15,-bh*.95],z:3.5,zb:8},neck:{par:'torso',at:[-bw*.3,bh*.4],z:6,zb:6}};
 bones.push(...accBones(D,k,ctx));
 const R={bones,plan:'fish',q:{lift,bh}};
 return finishRig(R,k,top,bw*1.4,lift)}
/* ---------- SERPENT ---------- */
function coilPart(Cd,C){const cw=Cd.w,ch=Cd.h,r1=sAnd(sE(0,-ch*.5,cw,ch*.5),sNot(sE(-cw*.05,-ch*.72,cw*.58,ch*.26))),r2=sAnd(sE(cw*.1,-ch*1.08,cw*.74,ch*.4),sNot(sE(cw*.05,-ch*1.24,cw*.36,ch*.16)));
 const g=[[r1],[r2]],l=[{f:r2,a:.55},{f:sE(-cw*.05,-ch*.72,cw*.58,ch*.26),a:.35}];
 const mat=Mat(C.fur,{c2:C.fur2,grad:C.fur2?[-cw,0,cw,-ch]:null,hi:.6,gloss:C.gloss,pat:Cd.pat?PATS[Cd.pat](C,Cd):PATS.scales(C)});
 const p=[{f:(x,y)=>(-ch*.14)-y,m:Mat(C.belly||mixHex(C.fur,'#FFFFFF',.5)),soft:1},{f:sAnd(r2,(x,y)=>(-ch*.82)-y),m:Mat(C.belly||mixHex(C.fur,'#FFFFFF',.5)),soft:1}];
 return {bb:[-cw*1.3,-ch*1.9,cw*1.3,2],th:ch*.3,g,mat,p,l,ao:.12}}
function segPart(len,r0,r1,C,pat){return {bb:[-r0*2,-len-r1*2,r0*2,r0*2],th:Math.max(r0,r1),g:[[sC(0,0,0,-len,r0,r1)]],mat:Mat(C.fur,{hi:.6,gloss:C.gloss,pat:pat?PATS[pat](C,{}):PATS.scales(C)}),p:[{f:(x,y)=>x+r0*.25,m:Mat(C.belly||mixHex(C.fur,'#FFFFFF',.5),{pat:(x,y,q,i,j,c)=>((Math.floor(y/2.2))&1)?mixA(c,INK,.15):null}),soft:.5,bk:false}],ao:0}}
function buildSerpent(D,k){const s=D.sz||1,C=D.c,Cd=dims(D.coil,{w:20,h:12},s),H=dims(D.head,{w:13,h:10},s),n=D.segs||4,sl=(D.segLen||6)*s,r0=(D.neckR||5)*s,bones=[];
 bones.push({n:'coil',at:[0,0],img:bake(coilPart(Cd,C),k),z:3,zb:3});
 let par='coil',at=[-Cd.w*.35,-Cd.h*1.35],tot=0;for(let i=0;i<n;i++){const ra=r0*(1-i*.08),rb=r0*(1-(i+1)*.08);bones.push({n:'n'+i,par,at,rr:i===0?-.25:.08,img:bake(segPart(sl,ra,rb,C,D.pat),k),z:4+i*.1,zb:4+i*.1});par='n'+i;at=[0,-sl];tot+=sl}
 if(D.hood)bones.push({n:'hood',par,at:[0,-sl*.4],img:bake({bb:[-H.w*2,-H.h*3,H.w*2,H.h],th:3,g:[[sE(0,-H.h*.9,H.w*1.35,H.h*1.3)]],mat:Mat(D.hood.c||C.fur,{hi:.6}),p:[{f:sE(0,-H.h*.6,H.w*.75,H.h*.9),m:Mat(D.hood.c2||C.belly||'#F4F2EC'),soft:1}],l:[{f:(x,y)=>Math.sin(x*.9)*1.2-.5,a:.25}]},k),z:4.5,zb:9});
 if(D.tail){const T=dims(D.tail,{k:'thin',len:10},s);bones.push({n:'tail',par:'coil',at:[Cd.w*.9,-Cd.h*.4],rr:-.4,img:bake(tailPart(T,C),k),z:2,zb:8})}
 const hp=headPart(H,C,false),hb=headPart(H,C,true),M=hp.M;bones.push({n:'head',par,at:[-H.w*.1,-sl+H.h*.2],rr:.2,img:bake(hp.pt,k,faceVariants(H,C,M)),imgB:bake(hb.pt,k),z:8,zb:8,face:1});
 const top=-Cd.h*1.35-tot*.95+M.hc-M.hh-(H.hair&&H.hair.k?M.hh*.5:0);
 const ctx={hat:{par:'head',at:[M.fx*.5+(D.hatX||0)*s,M.hc-M.hh*(D.hatY||.8)],z:9,zb:9},face:{par:'head',at:[M.fx,M.ey],z:9,zb:-1,hideB:1},mouth:{par:'head',at:M.mouth||[M.fx-M.hw*.7,M.hc+M.hh*.4],z:9,zb:9},hover:{par:'root',at:[0,top-6],z:9,zb:9},
  back:{par:'coil',at:[Cd.w*.2,-Cd.h*1.6],z:3.5,zb:3.5},hand:{par:'tail',at:[(D.tail&&D.tail.len||10)*s,-(D.tail&&D.tail.len||10)*s*.4],z:3,zb:8},neck:{par:'n'+(n-1),at:[0,-sl*.6],z:8.5,zb:7}};
 bones.push(...accBones(D,k,ctx));
 const R={bones,plan:'serpent',tipX:Cd.w*.8,q:{n}};
 return finishRig(R,k,top,Cd.w*1.2,0)}
/* ---------- WORM / CATERPILLAR ---------- */
function buildWorm(D,k){const s=D.sz||1,C=D.c,r=(D.r||6)*s,n=D.segs||5,H=dims(D.head,{w:11,h:10},s),bones=[];
 const seg=i=>({bb:[-r*1.6,-r*2.4,r*1.6,r*1.2],th:r,g:[[sE(0,-r,r*1.05,r)]],mat:Mat(i%2&&C.fur2?C.fur2:C.fur,{hi:.6,pat:D.pat?PATS[D.pat](C,{}):null}),p:[{f:(x,y)=>-r*.38-y,m:Mat(C.belly||mixHex(C.fur,'#FFFFFF',.45)),soft:1}],ao:.15,
  deco:A=>{A.ell(-r*.5,0,r*.22,r*.18,C.dark||'#2A2238');A.ell(r*.4,0,r*.22,r*.18,C.dark||'#2A2238');if(D.spots)A.ell(r*.1,-r*1.45,r*.28,r*.24,D.spots)}});
 for(let i=n-1;i>=0;i--)bones.push({n:'s'+i,at:[(i-.5)*r*1.45,0],img:bake(seg(i),k),z:4-i*.1,zb:4+i*.1});
 const hp=headPart(H,C,false),hb=headPart(H,C,true),M=hp.M;bones.push({n:'head',par:'s0',at:[-r*.35,-r*1.35],img:bake(hp.pt,k,faceVariants(H,C,M)),imgB:bake(hb.pt,k),z:6,zb:6,face:1});
 const top=-r*1.35+M.hc-M.hh-(H.horn&&H.horn.k?M.hh*.9:0);
 const ctx={hat:{par:'head',at:[M.fx*.5,M.hc-M.hh*.8],z:8,zb:8},face:{par:'head',at:[M.fx,M.ey],z:8,zb:-1,hideB:1},mouth:{par:'head',at:M.mouth||[M.fx-M.hw*.6,M.hc+M.hh*.45],z:8,zb:8},hand:{par:'head',at:M.mouth||[M.fx-M.hw*.6,M.hc+M.hh*.45],z:8,zb:8},hover:{par:'root',at:[0,top-6],z:9,zb:9},back:{par:'s2',at:[0,-r*1.8],z:5,zb:5}};
 bones.push(...accBones(D,k,ctx));
 const R={bones,plan:'worm',tipX:r*3,q:{n}};
 return finishRig(R,k,top,r*n*.8,0)}
/* ---------- OCTOPUS ---------- */
function tentPart(len,r0,r1,C,cups){return {bb:[-r0*2.2,-r0*1.5,r0*2.2,len+r0*1.5],th:r0,g:[[sC(0,0,0,len,r0,r1)]],mat:Mat(C.fur,{hi:.6,c2:C.fur2,grad:C.fur2?[0,0,0,len*2.5]:null}),p:cups?[{f:(x,y)=>x+r0*.35,m:Mat(C.belly||'#F6C8C0'),soft:.5}]:[],deco:cups?(A=>{for(let y=r0;y<len;y+=r0*1.4)A.ell(-r0*.45,y,Math.max(.6,r0*.3),Math.max(.6,r0*.3),C.cup||'#E89A9A')}):null,ao:0}}
function buildOcto(D,k){const s=D.sz||1,C=D.c,O=D.outfit,H=dims(D.head,{w:16,h:16,shape:'tall'},s),tl=(D.tlen||8)*s,tr=(D.tr||3.4)*s,lift=(D.lift||4)*s,bones=[{n:'fly',at:[0,-lift-tl*2.2]}];
 const hp=headPart(H,C,false),hb=headPart(H,C,true),M=hp.M;
 bones.push({n:'head',par:'fly',at:[0,H.h*.35],img:bake(hp.pt,k,faceVariants(H,C,M)),imgB:bake(hb.pt,k),z:6,zb:6,face:1});
 if(O&&O.k){const B={w:H.w*.66,h:H.h*.22,shape:'round'};bones.push({n:'collar',par:'fly',at:[0,H.h*.7],img:bake(Object.assign(torsoPart(B,C,O,false),{bb:[-B.w*1.5,-B.h*2.6,B.w*1.5,2]}),k),z:7.6,zb:7.6})}
 const xs=[-.78,-.48,-.16,.16,.48,.78],far=[1,3,5],n=xs.length;
 xs.forEach((x,i)=>{const isFar=far.includes(i)&&i!==1,z=isFar?2:7+(i===0?.5:0);let par='fly',at=[x*H.w*.8,H.h*.45];for(let j=0;j<3;j++){const L=tl*(j===2?.85:1),ra=tr*(1-j*.25),rb=tr*(1-(j+1)*.25);bones.push({n:'t'+i+j,par,at,rr:j===0?-x*.65:(x<0?.42:-.42)*(1+j*.2),img:bake(Object.assign(tentPart(L,ra,rb,C,j>0&&!isFar),{sh:isFar?-.12:0}),k),z:z+j*.01,zb:z+j*.01});par='t'+i+j;at=[0,L]}});
 const top=-lift-tl*2.2+H.h*.35+M.hc-M.hh;
 const ctx={hat:{par:'head',at:[M.fx*.4+(D.hatX||0)*s,M.hc-M.hh*(D.hatY||.86)],z:8,zb:8},face:{par:'head',at:[M.fx,M.ey],z:8,zb:-1,hideB:1},hand:{par:'t02',at:[0,tl*.8],z:8,zb:8},hover:{par:'root',at:[0,top-6],z:9,zb:9},back:{par:'head',at:[M.hw*.6,M.hc],z:5,zb:8},neck:{par:'fly',at:[0,H.h*.55],z:6.6,zb:6.6}};
 bones.push(...accBones(D,k,ctx));
 const R={bones,plan:'octo',q:{tl}};
 return finishRig(R,k,top,H.w*1.4,lift)}
/* ---------- BLOB ---------- */
function buildBlob(D,k){const s=D.sz||1,C=D.c,H=dims(D.head,{w:16,h:15,shape:'pear'},s),bones=[];
 const hp=headPart(H,C,false),hb=headPart(H,C,true),M=hp.M;
 if(D.drip)hp.pt.g.push([sUnion(sC(-H.w*.6,-H.h*.2,-H.w*.75,H.h*.08,2.2*s,1.8*s),sC(H.w*.5,-H.h*.25,H.w*.65,H.h*.05,1.8*s,1.5*s)),'s',2]),hb.pt.g.push([sUnion(sC(-H.w*.6,-H.h*.2,-H.w*.75,H.h*.08,2.2*s,1.8*s),sC(H.w*.5,-H.h*.25,H.w*.65,H.h*.05,1.8*s,1.5*s)),'s',2]);
 if(D.pat){hp.pt.mat=Mat(C.fur,{hi:.6,gloss:D.gloss,pat:PATS[D.pat](C,{})});hb.pt.mat=hp.pt.mat}
 bones.push({n:'head',at:[0,H.h*.1],img:bake(hp.pt,k,faceVariants(H,C,M)),imgB:bake(hb.pt,k),z:5,zb:5,face:1});
 if(D.puddle)bones.push({n:'puddle',at:[0,0],img:bake({bb:[-H.w*1.6,-4,H.w*1.6,4],th:1.5,g:[[sE(0,0,H.w*1.25,2.2*s)]],mat:Mat(C.fur,{gloss:.8,hi:.6,pat:D.pat?PATS[D.pat](C,{}):null})},k),z:1,zb:1});
 const nub=dims({len:4,r:2.6,hand:'paw'},{},s);bones.push({n:'armL',par:'head',at:[-H.w*.82,M.hc+H.h*.35],rr:.6,img:bake(armPart(nub,C,{},'near'),k),z:6,zb:4},{n:'armR',par:'head',at:[H.w*.82,M.hc+H.h*.35],rr:-.6,img:bake(armPart(nub,C,{},'far'),k),z:4,zb:4});
 const top=H.h*.1+M.hc-M.hh-(H.hair&&H.hair.k?M.hh*.4:0);
 const ctx={hat:{par:'head',at:[M.fx*.5+(D.hatX||0)*s,M.hc-M.hh*(D.hatY||.8)],z:8,zb:8},face:{par:'head',at:[M.fx,M.ey],z:8,zb:-1,hideB:1},hand:{par:'armL',at:[0,nub.len+2],z:6.5,zb:3},hover:{par:'root',at:[0,top-6],z:9,zb:9},back:{par:'head',at:[H.w*.4,M.hc-H.h*.6],z:4,zb:8}};
 bones.push(...accBones(D,k,ctx));
 const R={bones,plan:'blob',q:{}};
 return finishRig(R,k,top,H.w*1.2,0)}
/* ---------- SHELL CREATURES (hermit crab, snail) ---------- */
function buildShell(D,k){const s=D.sz||1,C=D.c,kind=D.kind||'crab',S=dims(D.shell,{w:14,h:14},s),H=dims(D.head,{w:8,h:7,eyes:{k:'big'},noNose:1},s),bones=[];
 if(kind==='snail'){const fl=(D.foot||26)*s,fr=(D.footR||5)*s;bones.push({n:'foot',at:[0,0],img:bake({bb:[-fl*.9,-fr*2.5,fl*.9,2],th:fr,g:[[sC(-fl*.38,-fr,fl*.42,-fr*.7,fr,fr*.55)]],mat:Mat(C.fur,{hi:.6,gloss:.5}),p:[{f:(x,y)=>y+fr*.4,m:Mat(C.belly||mixHex(C.fur,'#FFFFFF',.4)),soft:1}],l:[{f:(x,y)=>y>-fr*.5?Math.sin(x*.9)*1-.5:9,a:.2}],ao:.12},k),z:2,zb:2});
  bones.push({n:'shell',par:'foot',at:[fl*.08,-fr*1.4],img:bake(SHELLS[S.k](S,C,false),k),z:4,zb:4});
  bones.push({n:'head',par:'foot',at:[-fl*.42,-fr*1.2],img:null});}
 else{bones.push({n:'shell',at:[S.w*.3,-2*s],img:bake(SHELLS[S.k](S,C,false),k),z:4,zb:4});
  const lp={len:5*s,r:1.6*s,foot:'claw',thin:1};const Lp=bake(legPart(lp,C,{},'near'),k),Lf=bake(legPart(lp,C,{},'far'),k);
  bones.push({n:'body',at:[-S.w*.35,-6*s],img:bake({bb:[-9*s,-9*s,9*s,6*s],th:5*s,g:[[sE(0,-2*s,7*s,5.5*s)]],mat:Mat(C.fur,{hi:.6,gloss:.4})},k),z:3,zb:3});
  [[-S.w*.55,'l1',Lp,5],[-S.w*.35,'l2',Lp,5],[-S.w*.15,'l3',Lf,2]].forEach(([x,n,img,z],i)=>bones.push({n,at:[x,-4.5*s],rr:.5+i*.2,img,z,zb:z}));
  const big={len:6*s,r:2.4*s};bones.push({n:'armR',par:'body',at:[3*s,-2*s],rr:.3,img:bake(clawPart(big.len*.8,big.r*.8,C),k),z:2,zb:2},{n:'armL',par:'body',at:[-4*s,-1*s],rr:.5,img:bake(clawPart(big.len*(D.bigClaw||1.25),big.r*(D.bigClaw||1.25),C),k),z:6,zb:6});
  bones.push({n:'head',par:'body',at:[-2*s,-5*s],img:null})}
 const stalk=(D.stalk||7)*s,eyeR=H.w*.32;
 const hd={bb:[-H.w*2,-stalk-H.h*2,H.w*2,H.h],th:H.w*.4,g:[[sC(-H.w*.35,0,-H.w*.55,-stalk,1.2*s,1*s)],[sC(H.w*.35,0,H.w*.45,-stalk,1.2*s,1*s)],[sE(-H.w*.55,-stalk,eyeR,eyeR*1.1)],[sE(H.w*.45,-stalk,eyeR,eyeR*1.1)],[sE(0,1,H.w*.7,H.h*.45)]],mat:Mat(C.fur,{hi:.6})};
 const M={hw:H.w,hh:H.h,hc:0,fx:0,ey:-stalk,eL:[-H.w*.6,-stalk],eR:[H.w*.42,-stalk],erx:eyeR*.62,ery:eyeR*.78,mouth:[-H.w*.1,H.h*.25]};
 const hb=bones.find(b=>b.n==='head');Object.assign(hb,{img:bake(hd,k,faceVariants(Object.assign({mw:.5,blush:false},H),C,M)),imgB:bake(Object.assign({},hd,{back:true}),k),z:7,zb:7,face:1});
 const top=Math.min(-S.h*2.2,-stalk-12*s);
 const ctx={hat:{par:'shell',at:[S.hatX||0,-S.h*2.05],z:8,zb:8},hand:{par:'armL',at:[-2*s,8*s],z:7,zb:7},face:{par:'head',at:[M.fx,M.ey],z:8,zb:-1,hideB:1},hover:{par:'root',at:[0,top-6],z:9,zb:9},back:{par:'shell',at:[0,-S.h*2],z:5,zb:5}};
 bones.push(...accBones(D,k,ctx));
 const R={bones,plan:'shell',tipX:S.w,q:{}};
 return finishRig(R,k,top,S.w*1.4,0)}
function clawPart(len,r,C){const pin=sUnion(sE(-r*.2,len+r*1.1,r*1.5,r*1.25),sP([[-r*1.5,len+r*1.5],[-r*1.2,len+r*3.4],[-r*.2,len+r*1.8]],.5),sP([[r*.2,len+r*1.6],[r*.6,len+r*3.0],[r*1.2,len+r*1.2]],.5));
 return {bb:[-r*3,-r*1.5,r*3,len+r*4.5],th:r,g:[[sC(0,0,0,len,r*.7,r*.8)],[pin,'s',1]],mat:Mat(C.claw||C.fur,{hi:.6,gloss:.5}),l:[{f:(x,y)=>Math.abs(x+r*.4)-.3+(y<len+r*2?9:0),a:.6}],ao:0}}
/* ---------- SHELL / BACK STRUCTURES ---------- */
const SHELLS={
 conch:(S,C)=>{const w=S.w,h=S.h,f=sUnion(sE(0,-h*.9,w,h*.9),sP([[w*.2,-h*1.6],[w*.55,-h*2.25],[w*.75,-h*1.4]],2));
  return {bb:[-w*1.4,-h*2.6,w*1.4,2],th:h*.8,g:[[f]],mat:Mat(S.c||'#F2D2B0',{hi:.6,c2:S.c2||'#E89A7A',grad:[-w,-h*2,w,0]}),l:[{f:(x,y)=>Math.sin(Math.hypot(x-w*.2,y+h*.9)*.9)*1.4-.6,a:.3}],deco:A=>{if(S.keyhole){A.ell(-w*.2,-h*1.05,w*.13,w*.13,'#2A1E2E');A.rect(-w*.2-w*.06,-h*1.02,w*.12,h*.35,'#2A1E2E')}if(S.sign){A.rect(-w*.95,-h*.75,w*.7,h*.38,'#FFFFFF');A.rect(-w*.95,-h*.75,w*.7,h*.1,'#D9434B');A.line(-w*.85,-h*.48,-w*.35,-h*.48,'#8A8A9A')}},ao:.12}},
 building:(S,C)=>{const w=S.w,h=S.h,body=sB(0,-h,w*.8,h,1.5),roof=sP([[-w*.9,-h*2],[w*.9,-h*2],[w*.75,-h*2.2],[-w*.75,-h*2.2]],.5);
  return {bb:[-w*1.3,-h*2.6,w*1.3,2],th:4,g:[[body],[roof]],mat:Mat(S.c||'#B85A44',{hi:.5,pat:(x,y,q,i,j,c)=>((j%3===0)||((i+(Math.floor(j/3)&1)*2)%5===0))?mixA(c,INK,.15):null}),
   p:[{f:roof,m:Mat('#5A4A5A')}],deco:A=>{for(let yy=-h*1.8;yy<-h*.4;yy+=h*.38)for(let xx=-w*.6;xx<w*.6;xx+=w*.36){const lit=hsh(xx,yy,3)<.55;A.rect(xx,yy,w*.2,h*.22,lit?'#FFE59A':'#4A6A9A');A.px(xx,yy,lit?'#FFF6D0':'#8AB0E0')}A.rect(-w*.2,-h*.42,w*.4,h*.42,'#3A2A22')},ao:.1}},
 skyline:(S,C)=>{const w=S.w,h=S.h,T=[[-w*.55,h*2.2,w*.32],[-w*.1,h*2.9,w*.3],[w*.38,h*2.4,w*.32],[w*.7,h*1.6,w*.25],[-w*.85,h*1.5,w*.22]];const f=sUnion(...T.map(([x,hh,ww])=>sB(x,-hh/2,ww,hh/2,.8)),sP([[-w*.16,-h*2.9],[-w*.1,-h*3.5],[-w*.04,-h*2.9]],.3));
  return {bb:[-w*1.4,-h*3.7,w*1.4,2],th:3,g:[[f]],mat:Mat(S.c||'#3A4E7A',{c2:S.c2||'#9AD0F0',grad:[0,0,w*.4,-h*3],hi:.7,gloss:.6,pat:(x,y,q,i,j,c)=>(i%3===0||j%4===0)?mixA(c,INK,.25):(hsh(i>>1,j>>2,4)<.25?mixA(c,[255,236,160],.6):null)}),ao:.05}},
 kiosk:(S,C)=>{const w=S.w,h=S.h,cart=sB(0,-h*.7,w*.85,h*.7,1.5),awn=sP([[-w,-h*1.9],[w,-h*1.9],[w*1.1,-h*1.45],[-w*1.1,-h*1.45]],.6),poles=sUnion(sB(-w*.75,-h*1.6,.8,h*.45),sB(w*.75,-h*1.6,.8,h*.45));
  return {bb:[-w*1.5,-h*2.3,w*1.5,2],th:4,g:[[cart],[awn],[poles]],mat:Mat(S.c||'#E8D2A8',{hi:.5}),p:[{f:awn,m:Mat('#E84A5A',{pat:(x,y,q,i,j,c)=>((Math.floor((x+w)/3))&1)?mixA(c,[255,255,255],.85):null})},{f:poles,m:Mat('#C8CED3',{gloss:.6})},{f:sB(0,-h*1.0,w*.7,h*.22),m:Mat('#4AA8C8',{gloss:.7})}],
   deco:A=>{for(let i=0;i<4;i++)A.rect(-w*.6+i*w*.32,-h*1.18,w*.18,h*.16,['#F4C542','#E2547A','#5DBB7E','#AE8AEC'][i])},ao:.1}},
 store:(S,C)=>{const w=S.w,h=S.h,body=sB(0,-h,w,h,1),sign=sB(0,-h*2.05,w*.7,h*.22,1);
  return {bb:[-w*1.4,-h*2.6,w*1.4,2],th:4,g:[[body],[sign]],mat:Mat(S.c||'#D8D0C4',{hi:.5}),p:[{f:sign,m:Mat('#D9434B',{gloss:.5})},{f:sB(0,-h*.55,w*.42,h*.55),m:Mat('#7AC8E8',{gloss:.8,c2:'#2A5A8A',grad:[0,-h,0,0]})},{f:sB(0,-h*1.55,w*.95,h*.12),m:Mat(S.c2||'#2A3A5A')}],
   deco:A=>{A.line(-w*.5,-h*2.05,w*.5,-h*2.05,'#FFFFFF');for(let xx=-w*.85;xx<w*.85;xx+=w*.42)if(Math.abs(xx)>w*.4)A.rect(xx,-h*1.25,w*.25,h*.3,'#FFE59A')},ao:.1}},
 mall:(S,C)=>{const w=S.w,h=S.h,body=sB(0,-h*.9,w*1.05,h*.9,1.2),dome=sE(0,-h*1.8,w*.55,h*.55),wing=sB(w*.55,-h*1.7,w*.42,h*.3,1);
  return {bb:[-w*1.5,-h*2.6,w*1.5,2],th:4,g:[[body],[dome],[wing]],mat:Mat(S.c||'#E8E2F0',{hi:.6}),p:[{f:dome,m:Mat('#9AD8F0',{gloss:.9,c2:'#5A7AE8',grad:[0,-h*2.3,0,-h*1.3],pat:(x,y,q,i,j,c)=>(i%3===0||j%3===0)?mixA(c,[255,255,255],.35):null})},{f:sB(0,-h*1.15,w,h*.1),m:Mat('#F4C542',{gloss:.7})},{f:sB(-w*.1,-h*.45,w*.5,h*.45),m:Mat('#7AC8E8',{gloss:.8})}],
   deco:A=>{for(let i=0;i<5;i++)A.line(-w*.5+i*1.2,-h*.05-i*1.6,-w*.1+i*1.2,-h*.05-i*1.6,'#C8CED3');A.line(-w*.55,0,w*.1,-h*.85,'#7E8890')},ao:.1}},
 box:(S,C)=>{const w=S.w,h=S.h,f=sB(0,-h*.55,w,h*.75,1.2,-.04);
  return {bb:[-w*1.3,-h*1.6,w*1.3,h*.5],th:5,g:[[f]],mat:Mat(S.c||'#C48A4E',{hi:.45,pat:(x,y,q,i,j,c)=>hsh(i,j,2)<.08?mixA(c,INK,.1):null}),p:[{f:sB(0,-h*.55,w*.18,h*.8),m:Mat('#D8B27A',{gloss:.5})}],l:[{f:(x,y)=>y+h*1.12,a:.4}],
   deco:A=>{A.rect(-w*.75,-h*.62,w*.42,h*.3,'#FFFFFF');A.line(-w*.7,-h*.52,-w*.4,-h*.52,'#3A3F45');A.line(-w*.7,-h*.42,-w*.48,-h*.42,'#3A3F45')},ao:.15}},
 warehouse:(S,C)=>{const w=S.w,h=S.h,f=sUnion(sB(0,-h*.6,w,h*.6,1),sP([[-w,-h*1.2],[w,-h*1.2],[0,-h*1.75]],.5));
  return {bb:[-w*1.3,-h*2,w*1.3,2],th:4,g:[[f]],mat:Mat(S.c||'#5A7AB0',{hi:.5,pat:(x,y,q,i,j,c)=>i%2===0&&y>-h*1.2?mixA(c,INK,.15):null}),p:[{f:(x,y)=>y+h*1.2,m:Mat('#C8CED3',{gloss:.5})},{f:sB(-w*.3,-h*.35,w*.3,h*.35),m:Mat('#8A939C',{pat:(x,y,q,i,j,c)=>j%2?mixA(c,INK,.25):null})}],
   deco:A=>{A.rect(w*.15,-h*1.0,w*.6,h*.22,'#F4C542');A.line(w*.2,-h*.9,w*.7,-h*.9,'#2E3A5A')},ao:.1}},
 beetle:(S,C)=>{const w=S.w,h=S.h,f=sE(0,-h*.35,w,h*.75);
  return {bb:[-w*1.3,-h*1.4,w*1.3,h*.6],th:h*.6,g:[[f]],mat:Mat(S.c||'#2E5AD8',{gloss:.9,hi:.7,c2:S.c2||'#7A3AD8',grad:[-w,0,w,-h]}),l:[{f:(x,y)=>Math.abs(x-w*.05+y*.15)-.4,a:.6}],
   deco:A=>{[[-w*.45,-h*.55],[w*.45,-h*.45],[-w*.1,-h*.05]].forEach(([x,y])=>{A.ell(x,y,w*.16,h*.18,'#FFFFFF');A.ell(x+.5,y,w*.08,h*.09,'#16203A')})},ao:.1}},
 plates:(S,C)=>{const w=S.w,h=S.h,f=sE(0,-h*.3,w,h*.85);
  return {bb:[-w*1.3,-h*1.4,w*1.3,h*.8],th:h*.7,g:[[f]],mat:Mat(S.c||'#4A4038',{hi:.6,gloss:.6,pat:(x,y,q,i,j,c)=>{const n=Math.sin(x*.35+y*.2)+Math.sin(y*.5-x*.15);return q>=5&&n>1.1?mixA(c,[120,80,220],.4):null}}),l:[{f:(x,y)=>Math.sin((x+w)*.75)*1.6-1.1,a:.5}],ao:.1}},
 rocket:(S,C)=>{const w=S.w,h=S.h,body=sB(0,-h,w*.32,h,w*.3),nose=sP([[-w*.32,-h*1.75],[0,-h*2.6],[w*.32,-h*1.75]],1),fins=sUnion(sP([[-w*.3,-h*.5],[-w*.7,0],[-w*.3,0]],.4),sP([[w*.3,-h*.5],[w*.7,0],[w*.3,0]],.4));
  return {bb:[-w,-h*2.9,w,h*.8],th:w*.3,g:[[body],[nose],[fins]],mat:Mat('#E8ECF0',{gloss:.8}),p:[{f:nose,m:Mat(S.c||'#D9434B',{gloss:.8})},{f:fins,m:Mat(S.c||'#D9434B',{gloss:.8})}],deco:A=>{A.ell(0,-h*1.2,w*.14,w*.14,'#4F80E8');A.px(-w*.05,-h*1.25,'#FFFFFF');A.ell(0,h*.15,w*.18,h*.22,'#FFB02E');A.ell(0,h*.3,w*.1,h*.2,'#FF4A2E')},ao:0}},
};
/* ---------- PROPS (procedural held items, replace icons) ---------- */
const PROPS={
 laptop:o=>({bb:[-8,-10,8,3],th:1.5,g:[[sP([[-6,0],[6,0],[4.5,-8],[-7.5,-8]],.4)],[sB(0,.6,7,1,.6)]],mat:Mat(o.c||'#C8CED3',{gloss:.8}),p:[{f:sP([[-5,-1],[5,-1],[3.8,-7],[-6.4,-7]]),m:Mat('#5AB8F0',{flat:1,c2:'#2A4AA8',grad:[-6,-7,5,-1]})}],deco:A=>A.px(-1,-4,'#FFFFFF')}),
 phone:o=>({bb:[-4,-6,4,6],th:1,g:[[sB(0,0,2.6,4.6,1)]],mat:Mat('#26282E',{gloss:.9}),p:[{f:sB(0,-.2,1.9,3.7,.6),m:Mat('#7ADCFF',{flat:1,c2:'#4A5AE8',grad:[0,-4,0,4]})}],deco:A=>{A.px(-1,-2,'#FFFFFF');A.px(0,-1,'#FFFFFF')}}),
 guitar:o=>({bb:[-6,-17,7,8],th:2,g:[[sE(0,3,4.6,4)],[sE(.5,-2.5,3.4,3.2),'s',1.5],[sC(1.4,-4,4.2,-15,.9)],[sB(4.6,-15.5,1.4,1.6,.6,.3)]],mat:Mat(o.c||'#E8B26A',{gloss:.6,c2:o.c2||'#B8642A',rad:[0,2,6]}),p:[{f:sC(1.4,-4,4.2,-15,1),m:Mat('#5A3A22')}],deco:A=>{A.ell(.4,0,1.4,1.4,'#2A1E14');A.line(-.5,4,3.6,-14,'#F4F2EC');A.rect(-2,4.5,4,1,'#2A1E14')}}),
 gift:o=>({bb:[-6,-9,6,1],th:3,g:[[sB(0,-3.5,4.8,3.6,.8)],[sE(-1.6,-8,1.8,1.3,-.4)],[sE(1.6,-8,1.8,1.3,.4)]],mat:Mat(o.c||'#E2547A',{hi:.6}),p:[{f:sB(0,-3.5,1,3.8),m:Mat('#F4C542',{gloss:.7})},{f:sB(0,-5.8,5,.9),m:Mat('#F4C542',{gloss:.7})},{f:sUnion(sE(-1.6,-8,1.8,1.3,-.4),sE(1.6,-8,1.8,1.3,.4)),m:Mat('#F4C542',{gloss:.7})}]}),
 car:o=>({bb:[-12,-10,12,2],th:3,g:[[sB(0,-3.5,10,3,2)],[sP([[-5,-5],[-3,-9],[4,-9],[7,-5]],1.2)]],mat:Mat(o.c||'#D9434B',{gloss:.9,hi:.7}),p:[{f:sP([[-4,-5.5],[-2.6,-8],[3.5,-8],[5.6,-5.5]]),m:Mat('#9AD8F0',{gloss:.9,flat:1})}],deco:A=>{A.ell(-6,-.5,2.2,2.2,'#1E1A22');A.ell(6,-.5,2.2,2.2,'#1E1A22');A.ell(-6,-.5,1,1,'#C8CED3');A.ell(6,-.5,1,1,'#C8CED3');A.rect(-9,-8.5,2,6,'#F4C542');A.ell(-8,-11,2.5,2.2,'#F4C542')}}),
 umbrella:o=>({bb:[-9,-14,9,6],th:2,g:[[sAnd(sE(0,-6,8.5,7),(x,y)=>y+6)],[sC(0,-6,0,4,.7)],[sE(-.8,4.6,1.4,1)]],mat:Mat(o.c||'#2A2238',{gloss:.6}),p:[{f:sAnd(sE(0,-6,8.5,7),(x,y)=>y+6),m:Mat(o.c||'#2A2238',{gloss:.6,pat:(x,y,q,i,j,c)=>Math.abs(Math.sin(Math.atan2(y+6,x)*4))<.12?mixA(c,[255,255,255],.3):null})}]}),
 mic:o=>({bb:[-3,-8,3,6],th:2,g:[[sE(0,-4.5,2.4,2.6)],[sC(0,-2,0,5,1,.8)]],mat:Mat('#26282E',{gloss:.8}),p:[{f:sE(0,-4.5,2.4,2.6),m:Mat('#C8CED3',{gloss:.9,pat:(x,y,q,i,j,c)=>((i+j)&1)?mixA(c,INK,.25):null})}]}),
 rocketS:o=>SHELLS.rocket({w:5,h:5,c:o.c},{}),
 cup:o=>({bb:[-4,-7,4,2],th:2,g:[[sP([[-3,-6],[3,-6],[2.2,1],[-2.2,1]],.5)]],mat:Mat('#F4F2EC',{gloss:.4}),p:[{f:sB(0,-2.5,3,1.5),m:Mat(o.c||'#2F855A')},{f:sB(0,-6.3,3.4,.9,.4),m:Mat('#E8E2D0')}],deco:A=>A.ell(0,-2.5,1,1,'#FFFFFF')}),
 frappe:o=>({bb:[-5,-13,5,2],th:2,g:[[sP([[-3.4,-6],[3.4,-6],[2.4,1],[-2.4,1]],.5)],[sE(0,-7,3.6,2.6)],[sC(1,-8,2.4,-12.5,.5)]],mat:Mat('#E8D2B0',{a:.9}),p:[{f:sE(0,-7.5,3.6,2.4),m:Mat('#FFFFFF')},{f:sC(1,-8,2.4,-12.5,.6),m:Mat('#2F855A')},{f:sB(0,-2,3,1.4),m:Mat('#8A5A3A')}]}),
 bag:o=>({bb:[-6,-10,6,2],th:2.5,g:[[sB(0,-3,5,3.6,1)],[sAnd(sE(0,-6.5,3,3.2),sNot(sE(0,-6.5,1.8,2.2)))]],mat:Mat(o.c||'#8A5A2E',{gloss:.6,pat:PATS.mono({},{a:'#F4D78A'})}),deco:A=>A.rect(-1,-4,2,1.5,'#F4C542')}),
 diamond:o=>({bb:[-5,-6,5,5],th:2,g:[[sP([[-4,-1.5],[-2,-4.5],[2,-4.5],[4,-1.5],[0,4]],.3)]],mat:Mat('#9AE8FF',{gloss:1,flat:0,hi:.9,pat:(x,y,q,i,j,c)=>Math.abs(x)<.6||Math.abs(y+1.5)<.5?mixA(c,[255,255,255],.6):null})}),
 coffee:o=>PROPS.cup(o),
 scanner:o=>({bb:[-4,-6,6,4],th:1.5,g:[[sB(0,-2,3.4,2,1)],[sC(-1,0,-1.6,3.5,1.2)]],mat:Mat('#F4C542',{gloss:.6}),p:[{f:sB(.6,-2.2,2,1),m:Mat('#2A2238')}],deco:A=>A.line(-3.5,-2.2,-7,-2.6,'#FF4A4A')}),
 globe:o=>({bb:[-6,-7,6,6],th:4,g:[[sE(0,-1,5,5)]],mat:Mat('#4F9AE8',{gloss:.7,pat:(x,y,q,i,j,c)=>(Math.sin(x*.9)+Math.sin(y*1.1+x*.3)>.6)?mixA(c,[90,190,110],.85):null})}),
 tophat:o=>({bb:[-8,-14,8,1],th:2,g:[[sB(0,-1,7,1.1,.6)],[sB(0,-7,4.6,6.2,.8)]],mat:Mat(o.c||'#1E1A26',{gloss:.6}),p:[{f:sB(0,-2.6,4.7,1.1),m:Mat(o.band||'#D9434B')}]}),
 cowboy:o=>({bb:[-11,-9,11,2],th:2,g:[[sE(0,-1,10,2.2)],[sE(0,-4.5,5,4.2)]],mat:Mat(o.c||'#8A5A2E',{hi:.5}),p:[{f:sB(0,-2.8,5.2,.8),m:Mat('#3A2A1C')}],l:[{f:(x,y)=>Math.abs(x)-.4+(y<-6?0:9),a:.45}]}),
 crown:o=>({bb:[-7,-9,7,1],th:2,g:[[sP([[-5.5,0],[-6,-7],[-3,-4],[0,-8],[3,-4],[6,-7],[5.5,0]],.4)]],mat:Mat('#F4C542',{gloss:.9,hi:.7}),deco:A=>{A.ell(0,-2,1,1,'#D9434B');A.ell(-3.5,-2,.8,.8,'#4F80E8');A.ell(3.5,-2,.8,.8,'#5DBB7E')}}),
 cap:o=>({bb:[-9,-8,7,1],th:2,g:[[sAnd(sE(0,-1,5.6,6),(x,y)=>y+1)],[sE(-6,-1,4.4,1.3)]],mat:Mat(o.c||'#D9434B',{hi:.6})}),
 beret:o=>({bb:[-8,-6,8,1],th:2,g:[[sE(0,-2,6.5,2.8,-.15)],[sC(1,-4.5,1.6,-6,.5)]],mat:Mat(o.c||'#2A2238',{hi:.5})}),
 headset:o=>({bb:[-9,-4,9,8],th:1,g:[[sAnd(sE(0,4,8,8),sNot(sE(0,4,7,7)))]],mat:Mat('#26282E'),deco:A=>{A.ell(-7.5,4,1.6,2.4,'#3A3F45');A.line(-7,6,-4,8,'#26282E')}}),
 halo:o=>({bb:[-8,-4,8,3],th:1,g:[[sAnd(sE(0,0,6.5,2),sNot(sE(0,0,4.8,1.1)))]],mat:Mat('#FFE07A',{flat:1,gloss:1}),ol:false}),
 bracelets:o=>({bb:[-5,-3,5,3],th:1,g:[[sAnd(sE(0,0,3.6,1.8),sNot(sE(0,0,2.4,1)))]],mat:Mat('#F2B8E8',{pat:(x,y,q,i,j,c)=>[[255,214,240],[150,220,255],[255,226,120],[180,240,190]][(i>>1)%4]})}),
 sparkle:o=>({bb:[-5,-5,5,5],th:1,g:[[sP([[0,-4.5],[1,-1],[4.5,0],[1,1],[0,4.5],[-1,1],[-4.5,0],[-1,-1]],.2)]],mat:Mat(o.c||'#FFE6A8',{flat:1}),ol:false}),
ball:o=>({bb:[-6,-6,6,6],th:4,g:[[sE(0,0,4.6,4.6)]],mat:Mat(o.c||'#F07A2A',{hi:.55,gloss:.3}),l:[{f:(x,y)=>Math.abs(x+y*.25)-.35,a:.7},{f:(x,y)=>Math.abs(y-x*.2)-.35,a:.7},{f:(x,y)=>Math.abs(Math.hypot(x+5.5,y)-4.2)-.35,a:.7}]}),
 spoon:o=>({bb:[-9,-4,4,4],th:1.5,g:[[sE(-5.5,0,2.6,1.9)],[sC(-3,0,3,.4,.6,.5)]],mat:Mat('#DDE4EA',{gloss:1,hi:.8})}),
 fedora:o=>({bb:[-10,-9,10,2],th:2,g:[[sE(0,-.5,9,2)],[sB(0,-4.2,5,3.6,1.8)]],mat:Mat(o.c||'#5A4A3E',{hi:.5}),p:[{f:sB(0,-1.9,5.1,.9),m:Mat('#1E1A22')}],deco:A=>{A.rect(1.6,-5.6,3.2,2.2,'#FFFFFF');A.line(2,-4.6,4.2,-4.6,'#2A2238')},l:[{f:(x,y)=>Math.abs(x)-.4+(y<-5.5?0:9),a:.4}]}),
 derrick:o=>({bb:[-7,-20,7,2],th:1,g:[[sAnd(sP([[-5.5,0],[0,-18],[5.5,0]]),sNot(sP([[-3.8,-.8],[0,-15],[3.8,-.8]])))],[sB(0,-.6,6.5,.8)],[sB(0,-18.5,1.6,1.2)]],mat:Mat('#3A3540',{gloss:.4}),deco:A=>{for(let i=1;i<5;i++){const y=-i*3.4,w=5.5*(1-i/5.3);A.line(-w,y,w,y,'#5A5560');A.line(-w,y,w*.7,y-3.4,'#4A4550')}A.ell(0,-20.5,1,1.4,'#1A1410')}}),
 house:o=>({bb:[-7,-11,7,2],th:2,g:[[sB(0,-3,5,3.2,.6)],[sP([[-6.5,-5.5],[0,-10.5],[6.5,-5.5]],.4)]],mat:Mat(o.c||'#F4E8D0',{hi:.5}),p:[{f:sP([[-6.5,-5.5],[0,-10.5],[6.5,-5.5]],.4),m:Mat('#C8463A')}],deco:A=>{A.rect(-1,-3.6,2,3.6,'#7A4E2A');A.rect(-4,-5,2,1.8,'#9AD8F0');A.rect(2,-5,2,1.8,'#9AD8F0')}}),
 hardhat:o=>({bb:[-8,-8,8,2],th:2,g:[[sAnd(sE(0,-1,5.5,6),(x,y)=>y+1)],[sE(0,-.6,7.5,1.3)]],mat:Mat(o.c||'#F4C542',{gloss:.7,hi:.6}),l:[{f:(x,y)=>Math.abs(x)-.4+(y<-2?0:9),a:.4}]}),
 newsie:o=>({bb:[-9,-8,7,1],th:2,g:[[sAnd(sE(0,-1,6,5.5),(x,y)=>y+.8)],[sE(-5.8,-.8,4,1.2)],[sE(0,-6.4,1,.8)]],mat:Mat(o.c||'#8A7458',{hi:.5,pat:(x,y,q,i,j,c)=>((i%3===0)||(j%3===0))?mixA(c,INK,.18):null})}),
 bow:o=>({bb:[-7,-5,7,5],th:1.5,g:[[sE(-3.2,0,3,2.4,.3)],[sE(3.2,0,3,2.4,-.3)],[sE(0,0,1.4,1.4)]],mat:Mat(o.c||'#F27AA8',{gloss:.6,hi:.6})}),
 collar:o=>({bb:[-9,-4,9,4],th:1.5,g:[[sB(0,0,o.w||6,2.2,2)]],mat:Mat(o.c||'#1E1E24',{hi:.45}),l:[{f:(x,y)=>Math.sin(x*1.6)*1-.2,a:.3}]}),
 chainN:o=>({bb:[-8,-2,8,8],th:1,g:[[sAnd(sE(0,0,6,5.5),sNot(sE(0,-.4,5,4.7)))]],mat:Mat('#F4C542',{gloss:1,hi:.8}),p:[{f:(x,y)=>y<3?1:-1,m:null}]}),
 visor:o=>({bb:[-1,-1,1,1],th:1,g:[[sE(0,0,.1,.1)]],mat:Mat('#000000')}),
};
/* ---------- assembly & cache ---------- */
const PLAN={biped:buildBiped,quad:buildQuad,flyer:buildFlyer,fish:buildFish,serpent:buildSerpent,worm:buildWorm,octo:buildOcto,blob:buildBlob,shell:buildShell};
const RIGC={};
function rigParts(sp,gold,k=1){const key=sp+(gold?'g':'')+k;if(RIGC[key])return RIGC[key];const D=BEAST[sp]||BEAST.hood0;BGOLD=gold?1:0;let R;try{R=PLAN[D.plan](D,k)}finally{BGOLD=0}return RIGC[key]=R}
/* ---- DOM animator ---- */
const RIGDOM={vis:new Set(),io:null,last:0};
function sprHTML(sp,size,o={}){const w=Math.round(size*1.25),h=Math.round(w*RIGBOX.h/RIGBOX.w),st=SP[sp]?(SP[sp].rar==='mythical'?2:SP[sp].stage):2,f=[1.3,1.1,1][st];
 return `<canvas class="rig${o.sil?' sil':''}" width="${RIGBOX.w}" height="${RIGBOX.h}" data-sp="${sp}" data-g="${o.gold?1:0}" data-v="${o.view||'front'}"${o.still||o.sil?' data-still="1"':''}${o.act?` data-act="${o.act}"`:''} style="width:${w}px;height:${h}px;margin:${-Math.round((h-size)/2)}px ${-Math.round((w-size)/2)}px;transform:scale(${f});transform-origin:50% 94%" aria-hidden="true"></canvas>`}
function drawDomRig(c,ts){const sp=c.dataset.sp;if(!SP[sp])return;const R=rigParts(sp,c.dataset.g==='1',1),x=c.getContext('2d');if(c._seed==null){c._seed=rnd()*6;if(c.dataset.act)c._act={k:c.dataset.act,t0:ts}}
 x.imageSmoothingEnabled=false;x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,c.width,c.height);const a=c._act;let act=a&&ts-a.t0<1100?a.k:null;
 drawRig(x,R,rigPose(act,a?ts-a.t0:0,c.dataset.still?0:Math.floor(ts/50)*50,c._seed),c.dataset.v);if(c.classList.contains('sil'))rigTint(x,c.width,c.height,'#000000',1)}
function rigTick(ts){requestAnimationFrame(rigTick);if(ts-RIGDOM.last<48)return;RIGDOM.last=ts;
 if(!RIGDOM.io&&'IntersectionObserver' in window)RIGDOM.io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)RIGDOM.vis.add(e.target);else RIGDOM.vis.delete(e.target)}));
 let built=0;document.querySelectorAll('canvas.rig').forEach(c=>{if(!c._init){if(built>3&&RIGC[c.dataset.sp+(c.dataset.g==='1'?'g':'')+1]==null)return;built++;c._init=1;if(RIGDOM.io)RIGDOM.io.observe(c);else RIGDOM.vis.add(c);drawDomRig(c,ts);return}
  if(!c.dataset.still&&(RIGDOM.vis.has(c)||!RIGDOM.io))drawDomRig(c,ts)});
 RIGDOM.vis.forEach(c=>{if(!c.isConnected)RIGDOM.vis.delete(c)})}
requestAnimationFrame(rigTick);
document.addEventListener('pointerdown',ev=>{const card=ev.target.closest('button,.buddy,.slot,.dex,.enc');const c=card?card.querySelector('canvas.rig'):ev.target.closest('canvas.rig');if(c&&!c.dataset.still)c._act={k:'cheer',t0:performance.now()}},{passive:true});
