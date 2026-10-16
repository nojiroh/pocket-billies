/* ================= ANATOMY: heads, faces, bodies, outfits, limbs, tails, wings ================= */
const EYEDK=[28,18,46];
const C_=(C,k,d)=>C[k]||d;
const mirrorP=v=>v.map(([x,y])=>[-x,y]);
function noiseH(x,y,s=0){const v=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453;return v-Math.floor(v)}
/* ---------- HEAD ---------- */
function headMetrics(H){const hw=H.w,hh=H.h,hc=-hh*.9,turn=H.turn==null?1:H.turn,fx=-hw*.13*turn,es=H.eyes&&H.eyes.s||1;
 const ey=hc+hh*(H.eyeY==null?.06:H.eyeY),sp=H.eyeSp||.36;
 return {hw,hh,hc,fx,turn,ey,eL:[fx-hw*sp,ey],eR:[fx+hw*(sp-.02),ey],erx:hw*.19*es,ery:hh*.27*es}}
function headPart(H,C,back){const M=headMetrics(H),{hw,hh,hc,fx}=M,g=[],p=[],l=[],s=fx*.5;
 const fur=Mat(C.fur,C.fur2?{c2:C.fur2,grad:[0,hc-hh,0,hc+hh*1.1],hi:C.hi}:{hi:C.hi,gloss:H.gloss});
 const furL=C.belly?Mat(C.belly):Mat(mixHex(C.fur,'#FFFFFF',.55));
 const dk=Mat(C.dark||mixHex(C.fur,'#141022',.6));
 switch(H.shape){
  case 'wide':g.push([sE(0,hc,hw*1.06,hh*.9)]);break;
  case 'pear':g.push([sE(0,hc-hh*.12,hw*.84,hh*.82)],[sE(0,hc+hh*.22,hw,hh*.72),'s',hh*.5]);break;
  case 'tall':g.push([sE(0,hc,hw*.9,hh*1.04)]);break;
  case 'flat':g.push([sE(0,hc+hh*.05,hw,hh*.8)]);break;
  case 'box':g.push([sB(0,hc,hw*.95,hh*.92,hw*.45)]);break;
  default:g.push([sE(0,hc,hw,hh)]);
 }
 if(H.cheek){const cp=[[-hw*.9+s,hc+hh*.0],[-hw*1.22+s,hc+hh*.38],[-hw*.62+s,hc+hh*.66]];g.push([sP(cp,1),'s',2],[sP(mirrorP(cp).map(([x,y])=>[x+2*s,y]),1),'s',2])}
 /* ears */
 const EARS=[];const EARF=(x,y)=>{let d=1e9;for(const f of EARS){const e=f(x,y);if(e<d)d=e}return d};
 const E=H.ears||{},ek=E.k,es=E.s||1,earC=Mat(E.c||C.fur,{hi:C.hi}),inner=Mat(C.inner||'#F29BB0');
 if(ek==='round'||ek==='small'){const r=hw*(ek==='small'?.17:.3)*es,yy=hc-hh*(ek==='small'?.86:.74);[-1,1].forEach(sd=>{const cx=sd*hw*.66+s;const ef=sE(cx,yy,r,r*.95);EARS.push(ef);g.push([ef,'s',2]);if(!back||1)p.push({f:sE(cx+sd*-r*.12,yy+r*.15,r*.52,r*.5),m:inner,soft:.6,bk:false})})}
 if(ek==='point'||ek==='tuft'){const t=ek==='tuft'?.6:1;[-1,1].forEach(sd=>{const base=[[sd*hw*.9+s,hc-hh*.32*t],[sd*hw*.2+s,hc-hh*.86]],tip=[sd*hw*(.84+.12*es)+s,hc-hh*(.8+.68*es*t)];const tri=[base[0],tip,base[1]];EARS.push(sP(tri,1));g.push([sP(tri,1),'s',1.5]);
   const cx=(base[0][0]+tip[0]+base[1][0])/3,cy=(base[0][1]+tip[1]+base[1][1])/3;if(ek==='point')p.push({f:sP(tri.map(([x,y])=>[cx+(x-cx)*.5,cy+(y-cy)*.55+1])),m:inner,soft:.5,bk:false})})}
 if(ek==='long'){[-1,1].forEach(sd=>{const bx=sd*hw*.36+s,tx=sd*hw*(.52+.1*es)+s+(sd>0?hw*.2:0),ty=hc-hh*(1.7+.5*es),bend=sd>0&&E.flop;
   const f=bend?sCurve([bx,hc-hh*.6],[tx,ty+hh*.3],[tx+hw*.55,ty+hh*.75],hw*.2,hw*.16):sC(bx,hc-hh*.6,tx,ty,hw*.2,hw*.17);EARS.push((x,y)=>Math.max(f(x,y),y-(hc-hh*.75)));g.push([f,'s',2]);
   p.push({f:bend?sCurve([bx,hc-hh*.7],[tx,ty+hh*.3],[tx+hw*.5,ty+hh*.75],hw*.09,hw*.07):sC(bx,hc-hh*.7,tx,ty+hw*.08,hw*.09,hw*.08),m:inner,soft:.5,bk:false})})}
 if(ek==='floppy'){[-1,1].forEach(sd=>{const cx=sd*hw*(.92+.06*es)+s*.5,cy=hc+hh*.12;let f=sE(cx,cy,hw*.32*es,hh*.66*es,sd*-.18);if(E.fluff)f=sUnion(f,sE(cx,cy+hh*.5,hw*.36*es,hh*.3*es),sE(cx-sd*hw*.06,cy-hh*.38,hw*.3,hh*.3));g.push([f,'s',2]);p.push({f,m:earC})})}
 if(ek==='horns'){[-1,1].forEach(sd=>{const f=sCurve([sd*hw*.78+s,hc-hh*.3],[sd*hw*1.45+s,hc-hh*.4],[sd*hw*1.32+s,hc-hh*1.15],hh*.2,hh*.06);g.push([f]);p.push({f,m:Mat(C.horn||'#E8DCC0',{gloss:.5})})});
  [-1,1].forEach(sd=>{const f=sE(sd*hw*.98+s,hc+hh*.0,hw*.2,hh*.13,sd*.4);g.push([f,'s',1])})}
 if(ek==='fins'){[-1,1].forEach(sd=>{const tri=[[sd*hw*.7+s,hc-hh*.2],[sd*hw*1.35+s,hc-hh*.75],[sd*hw*.85+s,hc+hh*.35]];g.push([sP(tri,1),'s',2])})}
 /* hair & crests */
 const HR=H.hair||{},hk=HR.k,hair=Mat(HR.c||C.hair||C.fur,{c2:HR.c2,grad:HR.c2?[0,hc-hh,0,hc+hh]:null,hi:.6,gloss:HR.gloss}),fr=hc-hh*(HR.y==null?.18:HR.y);
 if(hk==='bangs'){const wave=(x)=>fr+Math.sin(x*1.3)*.6;p.push({f:(x,y)=>y-wave(x),m:hair,bk:false});p.push({f:ALL,m:hair,bk:true});
  if(HR.locks!==false)[-1,1].forEach(sd=>{const f=sC(sd*hw*.9+s*.4,hc-hh*.3,sd*hw*(1.0+(HR.long?.06:0))+s*.2,hc+hh*(HR.long?1.35:.75),hw*.2,hw*.22);g.push([f,'s',2]);p.push({f,m:hair})});
  l.push({f:(x,y)=>y-wave(x),half:1,a:.4,bk:false})}
 if(hk==='hood'){const reg=(x,y)=>Math.min(y-(hc-hh*.08),-(Math.abs(x-fx)-hw*.6)-(y>hc+hh*.62?99:0));p.push({f:(x,y)=>Math.max(reg(x,y),-EARF(x,y)),m:hair,bump:.8,bk:false});p.push({f:(x,y)=>Math.max(-1,-EARF(x,y)),m:hair,bk:true});g.push([sE(0,hc-hh*.06,hw*1.07,hh*1.0),'s',2]);l.push({f:(x,y)=>Math.max(reg(x,y),-EARF(x,y)),a:.45,bk:false})}
 if(hk==='caesar'){const f=(x,y)=>y-(hc-hh*.5+Math.abs(Math.sin(x*1.6))*.7);p.push({f,m:hair,bump:.8,bk:false});p.push({f:(x,y)=>y-(hc+hh*.2),m:hair,bk:true});g.push([sE(0,hc-hh*.3,hw*1.01,hh*.75),'s',1.5])}
 if(hk==='swoop'||hk==='part'){const f=(x,y)=>y-(hc-hh*.32+(x-fx)*(hk==='part'?-.12:.3)+Math.sin(x*.9)*.5);p.push({f,m:hair,bump:.6,bk:false});p.push({f:(x,y)=>y-(hc+hh*.25),m:hair,bk:true});g.push([sE(hk==='part'?hw*.1:-hw*.12,hc-hh*.55,hw*.95,hh*.55),'s',2]);
  if(hk==='part')l.push({f:(x,y)=>Math.max(Math.abs(x-hw*.28)-.5,y-(hc-hh*.35)),a:.45,bk:false})}
 if(hk==='blond'){const vol=sE(fx+hw*.55,hc+hh*.05,hw*.62,hh*.82);g.push([vol,'s',2.5]);p.push({f:(x,y)=>Math.min(y-(hc-hh*.3+(x-fx)*.28+Math.sin(x*1.1)*.7),Math.max(-(x-(fx+hw*.42)),y-(hc+hh*.7))),m:hair,bump:.7,bk:false});p.push({f:ALL,m:hair,bk:true});
  l.push({f:(x,y)=>Math.sin(x*1.3+y*.45)*1.2-.75+((y-(hc-hh*.3+(x-fx)*.28))<0||x>fx+hw*.42?0:9),a:.22})}
 if(hk==='pompom'){const r=hw*.42*(HR.s||1),cy=hc-hh*.92,F=sUnion(sE(s,cy,r,r*.9),sE(s-r*.7,cy+r*.35,r*.7,r*.62),sE(s+r*.7,cy+r*.35,r*.7,r*.62),sE(s,cy-r*.45,r*.8,r*.6));g.push([F,'s',2]);p.push({f:F,m:Mat(HR.c||C.fluff||C.fur,{pat:(x,y,q,i,j,c)=>noiseH(Math.floor(x/1.5),Math.floor(y/1.5),3)<.28?mixA(c,[255,255,255],.25):null})})}
 if(hk==='crest'){const n=HR.n||3;for(let i=0;i<n;i++){const a=-1.05+i*(.9/(n-1||1))+(HR.tilt||0),L=hh*(HR.len||.8)*(i===1?1.15:1);const f=sC(s+i*1.2-1.2,hc-hh*.75,s+Math.sin(a)*L,hc-hh*.75-Math.cos(a)*L,hh*.13,hh*.05);g.push([f,'s',1.2]);p.push({f,m:hair})}}
 if(hk==='spikes'||hk==='mohawk'){const n=hk==='mohawk'?4:5;for(let i=0;i<n;i++){const u=(i/(n-1)-.5),bx=s+u*hw*(hk==='mohawk'?.7:1.5),by=hc-hh*(.7+(.28-Math.abs(u)*.3)),tx=bx+u*hw*.6+(hk==='mohawk'?hw*.1:0),ty=by-hh*(.55+(.5-Math.abs(u))*.5);const tri=[[bx-hw*.2,by+hh*.2],[tx,ty],[bx+hw*.2,by+hh*.2]];g.push([sP(tri,.6),'s',1.5]);p.push({f:sP(tri,.6),m:hair})}
  p.push({f:(x,y)=>y-(hc-hh*.55),m:hair,bk:false,soft:1})}
 if(hk==='tuft'){const f=sUnion(sC(s,hc-hh*.8,s-hw*.2,hc-hh*1.32,hh*.12,hh*.04),sC(s+1,hc-hh*.8,s+hw*.15,hc-hh*1.22,hh*.1,hh*.04));g.push([f,'s',1.2])}
 if(hk==='bun'){const f=sE(s+hw*.25,hc-hh*1.0,hw*.32,hh*.28);g.push([f,'s',1.5]);p.push({f,m:hair});p.push({f:(x,y)=>y-(hc-hh*.45),m:hair,bk:false})}
 if(hk==='quiff'){const f=sCurve([s-hw*.5,hc-hh*.6],[s-hw*.6,hc-hh*1.35],[s+hw*.4,hc-hh*1.1],hh*.28,hh*.14);g.push([f,'s',2]);p.push({f,m:hair});p.push({f:(x,y)=>y-(hc-hh*.45),m:hair,bk:false})}
 if(hk==='curls'){const F=[];for(let i=0;i<6;i++){const a=-2.6+i*.42;F.push(sE(s+Math.cos(a)*hw*.95,hc+Math.sin(a)*hh*.9,hw*.28,hh*.26))}const f=sUnion(...F);g.push([f,'s',2]);p.push({f,m:hair});p.push({f:(x,y)=>y-(hc-hh*.5),m:hair,bk:false})}
 if(hk==='bald')p.push({f:(x,y)=>y-(hc-hh*.35),m:Mat(C.fur,{gloss:.9,hi:.7}),bk:null});
 /* horns & antennae */
 const HN=H.horn||{};
 if(HN.k==='uni'){const tri=[[s-hw*.2,hc-hh*.78],[s-hw*.1+(HN.lean||-hw*.18),hc-hh*(1.95+(HN.len||0))],[s+hw*.2,hc-hh*.82]];const f=sP(tri,.8);g.push([f]);p.push({f,m:Mat(HN.c||'#F7D774',{gloss:.8,c2:HN.c2||'#FFFFFF',grad:[0,hc-hh*.8,0,hc-hh*1.9]})});l.push({f:(x,y)=>Math.sin((y+x*.6)*1.4)*1.5,a:.3})}
 if(HN.k==='antenna'||HN.k==='feather'){[-1,1].forEach(sd=>{const f=sCurve([sd*hw*.32+s,hc-hh*.82],[sd*hw*.45+s,hc-hh*1.6],[sd*hw*(1.0)+s,hc-hh*1.9],.75,.6);g.push([f]);p.push({f,m:Mat(HN.c||C.dark||'#2A2238')});
  if(HN.k==='feather'){const fe=sE(sd*hw*.8+s,hc-hh*1.75,hw*.32,hh*.18,sd*.6);g.push([fe]);p.push({f:fe,m:Mat(HN.c2||HN.c||'#C9B98A',{pat:(x,y,q,i,j,c)=>(i&1)?mixA(c,INK,.3):null})})}
  else{const b=sE(sd*hw*1.0+s,hc-hh*1.92,1.6,1.6);g.push([b]);p.push({f:b,m:Mat(HN.c2||'#F4C542',{gloss:.8})})}})}
 if(HN.k==='crown'){}
 /* snout */
 const SN=H.snout||{},sk=SN.k,sl=SN.len||1;M.mouth=[fx-hw*.02,hc+hh*.5];
 const sno=Mat(SN.c||C.muzzle||C.belly||mixHex(C.fur,'#FFFFFF',.5),{gloss:SN.gloss});
 if(sk==='muzzle'){const cx=fx-hw*.06,cy=hc+hh*.4,f=sE(cx,cy,hw*.42*sl,hh*.3);g.push([f,'s',1.5]);p.push({f,m:sno,soft:.6,bump:1.2,bk:false});M.nose=[cx-hw*.12,cy-hh*.12];M.mouth=[cx-hw*.08,cy+hh*.12];M.muz=[cx,cy,hw*.42*sl,hh*.3]}
 if(sk==='long'){const bx=fx+hw*.05,by=hc+hh*.22,tx=fx-hw*(.95*sl),ty=hc+hh*.42,f=sC(bx,by,tx,ty,hh*.36,hh*.2);g.push([f,'s',2.5]);p.push({f:sAnd(f,(x,y)=>-(y-(by+(ty-by)*.2+hh*.02))),m:sno,soft:.6,bk:false});M.nose=[tx-hh*.05,ty-hh*.12];M.mouth=[tx+hw*.3,ty+hh*.14];M.long=[bx,by,tx,ty]}
 if(sk==='snake'){const cx=fx-hw*.42*sl,cy=hc+hh*.18,f=sE(cx,cy,hw*.62*sl,hh*.55);g.push([f,'s',hh*.5]);M.nose=null;M.nos=[cx-hw*.4*sl,cy-hh*.25];M.mouth=[cx-hw*.05,cy+hh*.3]}
 if(sk==='croc'||sk==='dino'){const big=sk==='dino',cx=fx-hw*(big?.55:.62)*sl,cy=hc+hh*(big?.32:.38),rw=hw*(big?.78:.82)*sl,rh=hh*(big?.42:.27),f=big?sE(cx,cy,rw,rh):sB(cx,cy,rw,rh,rh*.9);g.push([f,'s',3]);
  p.push({f:sAnd(f,(x,y)=>-(y-cy-rh*.15)),m:sno,soft:.8,bk:false});if(!big)g.push([sE(cx-rw*.85,cy-rh*.7,rh*.42,rh*.35),'s',1]);M.jaw=[cx,cy,rw,rh];M.nose=[cx-rw*.82,cy-rh*.62];M.mouth=[cx,cy+rh*.15]}
 if(sk==='beak'||sk==='hook'||sk==='toucan'||sk==='needle'||sk==='duck'||sk==='ptero'){const bk=Mat(SN.c||(sk==='needle'?(C.dark||'#2A2238'):C.beak)||'#F2A93B',{gloss:.7,c2:SN.c2,grad:SN.c2?[fx,hc,fx-hw*1.4,hc]:null});let f;
  if(sk==='beak')f=sP([[fx-hw*.02,hc-hh*.06],[fx-hw*(.62+.25*sl),hc+hh*.24],[fx+hw*.02,hc+hh*.42]],1);
  if(sk==='hook')f=sUnion(sE(fx-hw*.18,hc+hh*.2,hw*.26*sl,hh*.24),sCurve([fx-hw*.3,hc+hh*.02],[fx-hw*.6*sl,hc+hh*.2],[fx-hw*.38*sl,hc+hh*.58],hh*.16,hh*.04));
  if(sk==='toucan')f=sCurve([fx+hw*.05,hc+hh*.12],[fx-hw*1.05*sl,hc-hh*.15],[fx-hw*1.6*sl,hc+hh*.5],hh*.36,hh*.12);
  if(sk==='needle')f=sUnion(sE(fx-hw*.1,hc+hh*.3,hw*.2,hh*.16),sC(fx-hw*.2,hc+hh*.32,fx-hw*1.5*sl,hc+hh*.85,hh*.08,.4));
  if(sk==='duck')f=sB(fx-hw*.55,hc+hh*.3,hw*.48*sl,hh*.2,hh*.18,-.1);
  if(sk==='ptero')f=sP([[fx+hw*.1,hc-hh*.08],[fx-hw*1.9*sl,hc+hh*.32],[fx+hw*.05,hc+hh*.5]],1);
  g.push([f,'u']);p.push({f,m:bk});M.beak=f;M.beakK=sk;
  if(SN.tip)p.push({f:sAnd(f,(x,y)=>x-(fx-hw*1.25*sl)),m:Mat(SN.tip,{gloss:.6})});
  l.push({f:sk==='toucan'?((x,y)=>y-(hc+hh*.18+(fx-x)*.12)):sk==='hook'?((x,y)=>y-(hc+hh*.28)):((x,y)=>y-(hc+hh*.24+(fx-x)*.08)),a:.55,bk:false});
  M.mouth=null}
 /* markings */
 const MK=H.mark;
 if(MK==='mask'){const f=sE(fx,M.ey+.5,hw*.88,hh*.26);p.push({f,m:dk,soft:.8,bk:false});p.push({f:sE(fx,M.ey-hh*.34,hw*.5,hh*.12),m:furL,soft:1,bk:false})}
 if(MK==='disc'){[M.eL,M.eR].forEach(([x,y])=>p.push({f:sE(x,y+.5,M.erx*2.1,M.ery*1.7),m:furL,soft:.8,bk:false}));l.push({f:sUnion(...[M.eL,M.eR].map(([x,y])=>sE(x,y+.5,M.erx*2.1,M.ery*1.7))),a:.35,bk:false})}
 if(MK==='face'){p.push({f:sE(fx,hc+hh*.32,hw*.78,hh*.6),m:furL,soft:1,bk:false})}
 if(MK==='stripe'){p.push({f:sC(fx+hw*.05,hc-hh*.95,fx,hc-hh*.15,hw*.12,hw*.06),m:dk,soft:.6,bk:false})}
 if(MK==='ninja'){p.push({f:(x,y)=>Math.max(-(y-(M.ey-hh*.32)),y-(M.ey+hh*.3))<0?-1:1,m:Mat(C.mask||'#2A2440'),bk:null});p.push({f:sE(fx,hc+hh*.62,hw*.9,hh*.42),m:Mat(C.mask||'#2A2440'),bk:false})}
 if(MK==='freckle'){}
 const pt={bb:[-hw*2.6,hc-hh*2.9,hw*2.2,hh*1.3],th:Math.min(hw,hh)*.9,g,mat:fur,p,l,back,ao:.06};
 return {pt,M}}
/* ---------- FACE (deco per expression) ---------- */
function faceDeco(A,H,C,M,v){if(H.noFace)return;const E=H.eyes||{},ek=E.k||'big',iris=hexA(E.c||'#3A2A6A'),gl=H.glasses;
 const dk=EYEDK,lidC=hexA(H.lid||C.fur),darkF=lum(C.fur)<.28;
 const eye=([x,y],far)=>{const rx=M.erx*(far?.86:1),ry=M.ery*(far?.92:1);
  if(gl==='visor'||gl==='shades'&&v!=='hurt')return;
  if(v==='blink'||(ek==='closed'&&v!=='shout')){for(let i=-rx;i<=rx;i+=.5/A.k){A.px(x+i,y+ry*.25+Math.pow(i/rx,2)*-ry*.25,dk)}return}
  if(v==='happy'){for(let i=-rx;i<=rx;i+=.5/A.k){A.px(x+i,y+ry*.2-(1-Math.pow(i/rx,2))*ry*.55,dk)}return}
  if(v==='hurt'){const d=far?1:-1;for(let i=0;i<=1;i+=.08){A.px(x+d*rx*(.8-i*1.4)*.8,y-ry*.55+i*ry*.55,dk);A.px(x+d*rx*(.8-i*1.4)*.8,y+ry*.55-i*ry*.55,dk)}return}
  const big=v==='shout'?1.12:1;if(darkF&&ek!=='round'&&ek!=='wide')A.ell(x,y,rx*big+.9,ry*big+.9,'#ECE6F4');
  if(ek==='round'||ek==='wide'){A.ell(x,y,rx*1.15*big,ry*1.05*big,'#F6F4FA');A.ell(x-rx*.2,y+ry*.1,rx*.7,ry*.72,mixA(iris,dk,.15));A.ell(x-rx*.25,y+ry*.15,rx*.36,ry*.4,dk);A.ell(x-rx*.45,y-ry*.3,rx*.24,ry*.22,'#FFFFFF');
   for(let i=-rx*1.15;i<=rx*1.15;i+=.5/A.k)A.px(x+i,y-ry*1.05*big+Math.pow(i/rx/1.15,2)*ry*.35,mixA(lidC,INK,.6))}
  else if(ek==='bead'){A.ell(x,y,rx*.62*big,ry*.62*big,dk);A.px(x-rx*.25,y-ry*.25,'#FFFFFF')}
  else{A.ell(x,y,rx*big,ry*big,dk);A.ell(x,y+ry*.35,rx*.82*big,ry*.5*big,mixA(iris,dk,.25));A.ell(x,y+ry*.55,rx*.5,ry*.24,mixA(iris,[255,255,255],.25));
   A.ell(x-rx*.36,y-ry*.38,Math.max(.6,rx*.36),Math.max(.6,ry*.3),'#FFFFFF');A.px(x+rx*.42,y+ry*.36,'#FFFFFF')}
  if(ek==='sharp'||ek==='sleepy'){const cov=ek==='sleepy'?.55:.32;const slant=ek==='sharp'?(far?-.35:.35):0;for(let j=-ry*1.2;j<=ry*1.2;j+=.5/A.k)for(let i=-rx*1.25;i<=rx*1.25;i+=.5/A.k){const yy=-ry+ry*2*cov+i*slant;if(j<yy&&((i/rx)**2+(j/ry)**2)<1.35)A.px(x+i,y+j,lidC)}
   for(let i=-rx*1.1;i<=rx*1.1;i+=.5/A.k)A.px(x+i,y-ry+ry*2*cov+i*slant,mixA(lidC,INK,.65))}
  if(E.lash)for(let i=0;i<3;i++)A.px(x+(far?-rx:rx)*(.9+i*.18)*(far?1:-1)*-1,y-ry*(.8+i*.18),dk);
  if(ek==='laser'){A.ell(x,y,rx*.5,ry*.5,'#FF5A5A');A.px(x,y,'#FFFFFF')}};
 eye(M.eL,true);eye(M.eR,false);
 /* brows */
 const bw=H.brow;if(bw){const bc=hexA(C.brow||C.hair||'#F0F0F0');[M.eL,M.eR].forEach(([x,y],i)=>{const sd=i?1:-1,rx=M.erx*1.25;for(let u=-1;u<=1;u+=.1){const yy=y-M.ery*1.55+(bw==='angry'?u*sd*-.5*M.ery:bw==='thick'?-Math.abs(u)*.3:0)+(v==='hurt'?u*sd*.4:0);A.px(x+u*rx,yy,bc);if(bw==='thick'){A.px(x+u*rx,yy-1/A.k,bc)}}})}
 /* glasses */
 if(gl){const fc=hexA(C.frame||'#2A2238'),gold=hexA('#F4C542');
  if(gl==='round'||gl==='square'||gl==='monocle'){const list=gl==='monocle'?[M.eR]:[M.eL,M.eR];list.forEach(([x,y],i)=>{const far=gl!=='monocle'&&i===0,rx=M.erx*(far?1.45:1.65),ry=M.ery*1.35;if(gl==='square'){for(let u=-rx;u<=rx;u+=.5/A.k){A.px(x+u,y-ry,fc);A.px(x+u,y+ry,fc)}for(let w=-ry;w<=ry;w+=.5/A.k){A.px(x-rx,y+w,fc);A.px(x+rx,y+w,fc)}}else A.ring(x,y,rx,ry,.9,gl==='monocle'?gold:fc);A.px(x-rx*.5,y-ry*.5,[255,255,255],.6)});
   if(gl!=='monocle'){const [a,b]=M.eL,[c,d]=M.eR;A.line(a+M.erx*1.45,b-M.ery*.3,c-M.erx*1.65,d-M.ery*.3,fc)}else{A.line(M.eR[0]+M.erx*1.2,M.eR[1]+M.ery*1.2,M.eR[0]+M.erx*2.2,M.eR[1]+M.ery*4,gold)}}
  if(gl==='shades'&&v!=='hurt'){[M.eL,M.eR].forEach(([x,y],i)=>{const rx=M.erx*(i?1.7:1.45),ry=M.ery*1.15;A.ell(x,y+ry*.1,rx,ry,'#1A1626');A.line(x-rx*.6,y-ry*.2,x-rx*.1,y-ry*.6,'#8C86A8');A.px(x+rx*.4,y+ry*.4,'#4A4462')});A.line(M.eL[0],M.eL[1]-M.ery*.6,M.eR[0],M.eR[1]-M.ery*.6,'#1A1626')}
  if(gl==='visor'){const x0=M.eL[0]-M.erx*2.1,x1=M.eR[0]+M.erx*2.3,y=M.ey,h=M.ery*1.5;for(let yy=-h;yy<=h;yy+=.5/A.k)for(let xx=x0;xx<=x1;xx+=.5/A.k){const t=(xx-x0)/(x1-x0),edge=Math.abs(yy)>h-.7/A.k;A.px(xx,y+yy,edge?'#14101E':mixA(mixA([60,230,255],[180,90,255],t),[16,12,40],clamp((yy+h)/(2*h)*.55,0,.55)))}
   A.line(x0+1,y-h*.45,x0+(x1-x0)*.35,y-h*.45,[230,255,255]);A.px(x1-1,y+h*.3,[255,255,255])}
  if(gl==='goggles'){[M.eL,M.eR].forEach(([x,y],i)=>{A.ring(x,y,M.erx*1.6,M.ery*1.3,1.2,'#7A5A3A');A.ell(x,y,M.erx*1.2,M.ery*.95,[150,220,255],.55)})}}
 /* blush */
 if(H.blush!==false&&v!=='hurt'){const bc=hexA(C.blush||'#FF8FA8');[[M.eL[0]-M.erx*.6,M.ey+M.ery*1.8],[M.eR[0]+M.erx*.4,M.ey+M.ery*1.8]].forEach(([x,y])=>{for(let i=-2;i<=2;i++)for(let j=-1;j<=0;j++)if(((i+j)&1)===0&&A.ins(x+i/A.k*1.2,y+j/A.k))A.px(x+i/A.k*1.2,y+j/A.k,bc,.7)})}
 /* nose */
 if(M.nose&&!H.noNose){const [x,y]=M.nose,r=Math.max(1.2,H.w*.11);A.ell(x,y,r*1.2,r*.8,C.nose||'#2A1E2E');A.px(x-r*.4,y-r*.3,'#B8B0C8')}
 /* mouth */
 const mk=H.mouth||'smile',mc=hexA(C.mouthC||(lum(C.fur)<.28?'#E8DCF0':'#2A1426'));
 if(M.beak&&(v==='shout'||v==='happy')){const f=M.beak;for(let yy=-30;yy<30;yy+=.5/A.k)for(let xx=-30;xx<10;xx+=.5/A.k){const X=M.fx+xx,Y=M.hc+yy;const seam=M.beakK==='toucan'?(M.hc+H.h*.18+(M.fx-X)*.12):M.beakK==='hook'?(M.hc+H.h*.28):(M.hc+H.h*.24+(M.fx-X)*.08);if(f(X,Y)<-.6&&Math.abs(Y-seam)<(v==='shout'?1.6:.8)*(1-Math.max(0,(M.fx-X)/(H.w*1.4))))A.px(X,Y,'#3A0E1A')}}
 if(M.jaw&&!M.beak){const [cx,cy,rw,rh]=M.jaw;const open=v==='shout'?rh*.6:v==='happy'?rh*.3:0;for(let xx=-rw*.95;xx<=rw*.6;xx+=.5/A.k){const yy=cy+rh*.15+Math.sin(xx*.15)*.3;A.px(cx+xx,yy,mc);if(open){for(let o=0;o<open;o+=.5/A.k)A.px(cx+xx,yy+o,o>open-1.2?mc:'#7A1E2E')}if(((Math.floor((cx+xx)*A.k))%3)===0&&xx<rw*.5)A.px(cx+xx,yy-1/A.k,'#FFFFFF')}}
 else if(M.mouth&&mk!=='none'){const [x,y]=M.mouth,w=H.w*(H.mw||.2);
  if(v==='shout'){A.ell(x,y+w*.25,w*.62,w*.55,mc);A.ell(x,y+w*.45,w*.36,w*.22,'#E0607A')}
  else if(v==='happy'||mk==='grin'){A.ell(x,y+w*.1,w*.8,w*.45,mc);A.rect(x-w*.8,y-w*.4,w*1.6,w*.48,C.fur);for(let i=-w*.8;i<=w*.8;i+=.5/A.k)A.px(x+i,y+w*.08,mc);A.ell(x+w*.1,y+w*.35,w*.38,w*.16,'#E0607A');if(mk==='grin')for(let i=-w*.6;i<=w*.6;i+=.5/A.k)A.px(x+i,y+w*.14,'#FFFFFF')}
  else if(v==='hurt'){for(let i=-w*.7;i<=w*.7;i+=.5/A.k)A.px(x+i,y+Math.sin(i*2.2)*.6,mc)}
  else if(mk==='cat'){for(let i=-w*.8;i<=w*.8;i+=.5/A.k){const yy=Math.abs(Math.sin((i/w)*Math.PI*.9))*w*.32;A.px(x+i,y+yy,mc)}}
  else if(mk==='smirk'){for(let i=-w*.7;i<=w*.8;i+=.5/A.k)A.px(x+i,y+(i>0?-(i/w)*w*.4:Math.pow(i/w,2)*w*.18),mc)}
  else if(mk==='flat'){for(let i=-w*.6;i<=w*.6;i+=.5/A.k)A.px(x+i,y,mc)}
  else if(mk==='tongue'){for(let i=-w*.7;i<=w*.7;i+=.5/A.k)A.px(x+i,y+Math.pow(i/w,2)*-w*.35+w*.12,mc);A.ell(x+w*.25,y+w*.38,w*.28,w*.32,'#E8607A');A.px(x+w*.2,y+w*.3,'#FFB0C0')}
  else if(mk==='lips'){A.ell(x,y,w*.75,w*.34,'#D62A55');A.line(x-w*.6,y,x+w*.6,y,'#6A0E28');A.px(x-w*.3,y-w*.15,'#FFC0D0')}
  else{for(let i=-w*.7;i<=w*.7;i+=.5/A.k)A.px(x+i,y+Math.pow(i/w,2)*-w*.35+w*.12,mc)}
  if(H.fang&&v!=='hurt'){A.px(x+w*.35,y+w*.25,'#FFFFFF');A.px(x+w*.35,y+w*.25+1/A.k,'#FFFFFF')}}
 if(M.nos){const [x,y]=M.nos;A.px(x,y,'#2A1426');A.px(x+1.6,y-.2,'#2A1426')}
 if(H.goatee){const [x,y]=M.mouth||[M.fx,M.hc+H.h*.6];A.ell(x+H.w*.02,y+H.h*.24,H.w*.12,H.h*.12,C.hair||'#E8C870')}
 if(H.stache){const [x,y]=M.mouth||[M.fx,M.hc+H.h*.55];for(let i=-1;i<=1;i+=.05)A.px(x+i*H.w*.3,y-H.h*.06-Math.abs(i)*-H.h*.05,C.brow||'#E8E8E8');for(let i=-1;i<=1;i+=.05)A.px(x+i*H.w*.3,y-H.h*.06+1/A.k,C.brow||'#E8E8E8')}
 if(H.whisk){[[-1],[1]].forEach(([sd])=>{const [x,y]=M.nose||M.mouth||[M.fx,M.hc];for(let w=0;w<2;w++)A.line(x+sd*H.w*.3,y+w*1.5,x+sd*H.w*.75,y-1.5+w*2.5,'#2A2238',.6)})}
}
/* ---------- BODY / TORSO with outfits ---------- */
const CLOTH=(c,o={})=>Mat(c,Object.assign({hi:.38},o));
function bodyShape(B){const tw=B.w,th=B.h;switch(B.shape){
 case 'pear':return [[sE(0,-th*.92,tw,th*.92)],[sE(0,-th*1.42,tw*.8,th*.62),'s',th*.5]];
 case 'v':return [[sE(0,-th*1.34,tw*1.08,th*.66)],[sE(0,-th*.72,tw*.8,th*.72),'s',th*.6]];
 case 'tall':return [[sE(0,-th,tw*.84,th)]];
 case 'barrel':return [[sB(0,-th,tw,th,tw*.55)]];
 case 'insect':return [[sE(0,-th*1.15,tw*.72,th*.72)],[sE(tw*1.0,-th*.55,tw*1.05,th*.55,.45),'s',2]];
 case 'egg':return [[sE(0,-th*.86,tw,th*.86)],[sE(0,-th*1.36,tw*.72,th*.64),'s',th*.5]];
 default:return [[sE(0,-th,tw,th)]]}}
function torsoPart(B,C,O,back){const tw=B.w,th=B.h,g=bodyShape(B),p=[],l=[],T=-2*th;O=O||{};
 const fur=Mat(C.fur,C.fur2?{c2:C.fur2,grad:[0,T,0,0],hi:C.hi}:{hi:C.hi,pat:B.pat?PATS[B.pat](C,B):null});
 if(B.belly!==false&&C.belly&&!O.cover)p.push({f:sE(-tw*.14,-th*(B.bellyY||.82),tw*(B.bellyW||.6),th*(B.bellyH||.68)),m:Mat(C.belly,{pat:B.bpat?PATS[B.bpat](C,B):null}),soft:.8,bump:.6,bk:false});
 const deco=[];const k=O.k;
 const gar=O.c?CLOTH(O.c,{pat:O.pat?PATS[O.pat](C,O):null,c2:O.c2g,grad:O.c2g?[0,T,0,0]:null,gloss:O.gloss}):null,acc=O.a||'#D9434B',shirt=O.shirt||'#F4F2EC';
 const neckW=tw*.34;
 const V=(depth,w=neckW)=>sP([[-w-tw*.12,T-2],[w-tw*.12,T-2],[-tw*.12,T+th*2*depth]]);
 if(k==='hoodie'){p.push({f:ALL,m:gar});const hood=sE(0,T+th*.18,tw*.74,th*.32);g.push([hood,'s',2]);l.push({f:sE(0,T+th*.18,tw*.5,th*.18),a:.4,bk:false});
  p.push({f:sB(-tw*.1,-th*.55,tw*.5,th*.28,th*.15),m:CLOTH(shadeHex(O.c,.88)),bk:false});l.push({f:sB(-tw*.1,-th*.55,tw*.5,th*.28,th*.15),a:.45,bk:false});
  deco.push((A)=>{if(back)return;[-1,1].forEach(sd=>{for(let y=T+th*.3;y<T+th*.95;y+=.5/A.k)A.px(-tw*.12+sd*tw*.18,y,O.a||'#F4F2EC')})});
  if(back){l.push({f:sE(0,T+th*.6,tw*.55,th*.48),a:.45,bk:true});p.push({f:sE(0,T+th*.6,tw*.55,th*.48),m:CLOTH(shadeHex(O.c,.9)),bk:true})}}
 if(k==='tee'||k==='jersey'){p.push({f:ALL,m:gar});deco.push(A=>{if(back)return;A.ring(-tw*.12,T+.5,neckW*1.1,th*.18,1,mixHex(O.c,'#000000',.35));if(k==='jersey'&&O.num){numDeco(A,O.num,-tw*.12,-th*1.1,th*.5,O.a||'#FFFFFF')}if(O.print)O.print(A,tw,th)})}
 if(k==='suit'||k==='blazer'||k==='western'||k==='tux'){p.push({f:ALL,m:gar});if(!back){const vd=k==='tux'?.62:.55;p.push({f:V(vd),m:CLOTH(shirt),bk:false});l.push({f:V(vd,neckW*1.35),a:.55,bk:false});
   if(k==='suit')p.push({f:sP([[-tw*.12-1.4,T+1],[-tw*.12+1.4,T+1],[-tw*.12+1.8,T+th*1.0],[-tw*.12,T+th*1.18],[-tw*.12-1.8,T+th*1.0]]),m:Mat(acc,{gloss:.4}),bk:false});
   if(k==='tux'||O.bow)deco.push(A=>{const x=-tw*.12,y=T+2.2;A.ell(x-2,y,1.8,1.3,'#1A1626');A.ell(x+2,y,1.8,1.3,'#1A1626');A.px(x,y,'#3A3448')});
   if(k==='western')deco.push(A=>{const x=-tw*.12;A.line(x-1.5,T+1.5,x,T+th*.7,'#2A1E14');A.line(x+1.5,T+1.5,x,T+th*.7,'#2A1E14');A.ell(x,T+th*.5,1.5,1.3,'#F4C542')});
   deco.push(A=>{for(let i=0;i<(k==='blazer'?2:2);i++)A.ell(-tw*.12,-th*(.72-i*.32)+0,0.9,0.9,O.btn||mixHex(O.c,'#000000',.45));if(O.pocket!==false){A.rect(tw*.32,T+th*.75,tw*.32,1.2,O.pocket||'#F4F2EC')}if(O.crest)crestDeco(A,tw*.38,T+th*.95)})}
  else l.push({f:(x,y)=>Math.abs(x)-.4,a:.35,bk:true})}
 if(k==='vest'){p.push({f:(x,y)=>Math.abs(x+tw*.12)-tw*.28<0?1:-1,m:gar});p.push({f:sB(0,-th*.7,tw*1.4,th*.12),m:CLOTH(O.a||'#E8EEF2',{gloss:.6}),bk:null});p.push({f:sB(0,-th*1.25,tw*1.4,th*.1),m:CLOTH(O.a||'#E8EEF2',{gloss:.6}),bk:null});
  if(back)p.push({f:ALL,m:gar,bk:true}),p.push({f:sB(0,-th*.7,tw*1.4,th*.12),m:CLOTH(O.a||'#E8EEF2',{gloss:.6}),bk:true});
  if(O.badge)deco.push(A=>{if(back)return;A.rect(tw*.22,T+th*.85,tw*.38,th*.26,'#FFFFFF');A.rect(tw*.22,T+th*.85,tw*.38,th*.08,'#D9434B')})}
 if(k==='fleece'){p.push({f:ALL,m:gar});deco.push(A=>{if(back)return;for(let y=T+1;y<-1;y+=.5/A.k)A.px(-tw*.12,y,'#C8CED3');A.rect(-tw*.12-neckW,T,neckW*2,1.6,shadeHex(O.c,.75));A.rect(tw*.28,T+th*.55,tw*.22,th*.16,O.a||'#FFFFFF')})}
 if(k==='sweater'||k==='cardigan'){p.push({f:ALL,m:gar});if(!back){if(k==='sweater'){p.push({f:V(.42),m:CLOTH(O.shirt||'#F4F2EC'),bk:false});l.push({f:V(.42,neckW*1.15),a:.5,bk:false});deco.push(A=>{const x=-tw*.12;A.line(x-neckW*.9,T+.5,x-neckW*.25,T+th*.3,'#FFFFFF');A.line(x+neckW*.9,T+.5,x+neckW*.25,T+th*.3,'#FFFFFF')})}
   else{p.push({f:sB(-tw*.12,-th,tw*.16,th*1.2),m:CLOTH(O.shirt||'#F4F2EC'),bk:false});l.push({f:sB(-tw*.12,-th,tw*.18,th*1.2),a:.45,bk:false});deco.push(A=>{for(let i=0;i<3;i++)A.ell(-tw*.12+tw*.24,-th*(1.35-i*.4),.8,.8,'#F4E8C8')})}}
  l.push({f:(x,y)=>y+th*.2,a:.3});deco.push(A=>{for(let x=-tw;x<tw;x+=2/A.k)A.dark(x,-th*.16,.25)})}
 if(k==='turtle'){p.push({f:ALL,m:gar});const roll=sB(0,T+th*.1,neckW*1.35,th*.2,th*.18);g.push([roll,'s',1.2]);p.push({f:roll,m:CLOTH(shadeHex(O.c,1.15))});l.push({f:(x,y)=>Math.sin(x*1.8)*.9+.2,a:.2})}
 if(k==='apron'){if(O.under)p.push({f:ALL,m:CLOTH(O.under)});const ap=sB(-tw*.12,-th*.75,tw*.72,th*.85,th*.25);p.push({f:ap,m:gar,bk:false});l.push({f:ap,a:.45,bk:false});
  deco.push(A=>{if(back){A.line(-tw,-th*.9,tw,-th*.9,O.c);return}A.line(-tw*.6,-th*1.55,-tw*.4,T+1,O.c);A.line(tw*.38,-th*1.55,tw*.18,T+1,O.c);A.rect(-tw*.42,-th*.85,tw*.6,1.2,shadeHex(O.c,.75));if(O.logo)A.ell(-tw*.12,-th*1.15,1.8,1.8,O.logo)})}
 if(k==='robe'){p.push({f:ALL,m:gar});p.push({f:V(.7,neckW*.9),m:CLOTH(O.shirt||'#F4F2EC'),bk:false});l.push({f:V(.7,neckW*1.25),a:.5,bk:false})}
 if(k==='ninja'){p.push({f:ALL,m:gar});p.push({f:sB(0,-th*.55,tw*1.3,th*.12),m:CLOTH(O.a||'#C9343C')});l.push({f:(x,y)=>(y-(T+(x+tw*.6)*1.1)),a:.5,bk:false})}
 if(k==='jacket'){p.push({f:ALL,m:gar});if(!back){p.push({f:V(.45),m:CLOTH(O.shirt||'#26282E'),bk:false});l.push({f:V(.45,neckW*1.3),a:.5,bk:false})}deco.push(A=>{if(!back)for(let y=T+th*.9;y<-1;y+=.5/A.k)A.px(-tw*.12,y,'#C8CED3')})}
 if(k==='sequin'){p.push({f:ALL,m:CLOTH(O.c,{gloss:.6,pat:(x,y,q,i,j,c)=>{const n=noiseH(i>>1,j>>1,7);return n<.16?mixA(c,[255,255,255],.75):n>.9?mixA(c,hexA(O.a||'#FFD6F0'),.6):null}})})}
 if(k==='gown'){p.push({f:ALL,m:gar})}
 if(O.pearls||O.chain){const col=O.pearls?'#FBF6F0':'#F4C542';deco.push(A=>{if(back)return;for(let a=.15;a<=Math.PI-.15;a+=.22)A.ell(-tw*.12+Math.cos(a)*neckW*1.25,T+1.5+Math.sin(a)*th*.42,O.pearls?.95:.7,O.pearls?.95:.7,col)})}
 if(O.sash){const f=(x,y)=>Math.abs((y-T)-(x+tw)*(2*th/(2*tw))*.9)-th*.16;p.push({f,m:CLOTH(O.sash,{gloss:.5}),bk:false})}
 if(O.mono)p.push({f:ALL,m:Mat(O.c||C.fur,{pat:PATS.mono(C,O)})});
 if(O.scarf){const sf=sB(-tw*.1,T+th*.12,neckW*1.5,th*.16,th*.12);g.push([sf,'s',1]);p.push({f:sf,m:CLOTH(O.scarf)})}
 if(O.bracelets){}
 const pt={bb:[-tw*1.5,T-th*.6,tw*1.5,2],th:Math.min(tw,th)*.95,g,mat:fur,p,l,back,ao:.1,deco:deco.length?(A=>deco.forEach(d=>d(A))):null};
 return pt}
function numDeco(A,num,x,y,h,c){const D={'0':['111','101','101','101','111'],'1':['010','110','010','010','111'],'2':['111','001','111','100','111'],'3':['111','001','111','001','111'],'4':['101','101','111','001','001'],'5':['111','100','111','001','111'],'6':['111','100','111','101','111'],'7':['111','001','010','010','010'],'8':['111','101','111','101','111'],'9':['111','101','111','001','111']};
 const s=String(num),w=s.length*4-1;s.split('').forEach((ch,n)=>{const g=D[ch];g.forEach((row,j)=>{for(let i=0;i<3;i++)if(row[i]==='1')A.px(x-w/2+n*4+i,y-h/2+j,c)})})}
function crestDeco(A,x,y){[[0,0],[1,0],[2,0],[0,1],[2,1],[1,2],[1,1]].forEach(([i,j])=>A.px(x+i,y+j,j===1&&i===1?'#2A3A7A':'#F4C542'))}
const PATS={
 spots:(C,B)=>(x,y,q,i,j,c)=>noiseH(Math.floor(x/3),Math.floor(y/3),2)<.22&&noiseH(x,y,3)<.8?mixA(c,hexA(C.spot||C.dark||'#2A1E2E'),.6):null,
 stripes:(C,B)=>(x,y,q,i,j,c)=>((Math.floor((y+x*.3)/3))&1)?mixA(c,hexA(C.stripe||C.dark||'#2A1E2E'),.55):null,
 scales:(C)=>(x,y,q,i,j,c)=>{const u=x/3,v=y/2.4+((Math.floor(x/3))&1)*.5,fu=u-Math.floor(u),fv=v-Math.floor(v);return (fv<.2||Math.abs(fu-.5)<.12&&fv>.75)?mixA(c,INK,.25):(fu<.5&&fv<.5?mixA(c,[255,255,255],.08):null)},
 feather:(C)=>(x,y,q,i,j,c)=>{const v=y/3+((Math.floor(x/4))&1)*.5,fv=v-Math.floor(v),fu=(x/4)-Math.floor(x/4);return fv>.78&&Math.abs(fu-.5)<.45?mixA(c,INK,.22):null},
 mono:(C,O)=>(x,y,q,i,j,c)=>{const u=((Math.floor(x/5)+Math.floor(y/5))&1),fx=((x%5)+5)%5,fy=((y%5)+5)%5;if(u&&((fx===1&&fy>0&&fy<4)||(fy===3&&fx>0&&fx<4)))return mixA(c,hexA(O.a||'#F4D78A'),.7);if(!u&&((fx===2&&fy===2)||(fx===2&&fy===1)||(fx===1&&fy===2)||(fx===3&&fy===2)||(fx===2&&fy===3)))return mixA(c,hexA(O.a||'#F4D78A'),.55);return null},
 oil:(C)=>(x,y,q,i,j,c)=>{const n=Math.sin(x*.35+y*.2)+Math.sin(y*.5-x*.15);return q>=5&&n>1.1?mixA(c,[120,80,220],.5):q>=5&&n>.6?mixA(c,[60,200,180],.4):null},
 sequin:(C)=>(x,y,q,i,j,c)=>{const n=noiseH(i>>1,j>>1,11);return n<.14?mixA(c,[255,255,255],.75):n>.9?mixA(c,hexA(C.spark||'#FFD6F0'),.6):null},
 plates:(C)=>(x,y,q,i,j,c)=>((Math.floor((x+40)/4.5))%2===0&&q<6)?mixA(c,INK,.12):null,
 fuzz:(C)=>(x,y,q,i,j,c)=>noiseH(i,j,5)<.2?mixA(c,[255,255,255],.18):noiseH(i,j,6)<.12?mixA(c,INK,.18):null,
 rings:(C)=>(x,y,q,i,j,c)=>((Math.floor(y/4))&1)?mixA(c,hexA(C.stripe||C.dark),.6):null,
 diamond:(C)=>(x,y,q,i,j,c)=>{const u=Math.abs(((x+y*.6)%8+8)%8-4)+Math.abs(((y)%6+6)%6-3);return u<2.2?mixA(c,hexA(C.spot||C.dark),.55):null},
 bands:(C)=>(x,y,q,i,j,c)=>((Math.floor((x*.8-y*.5)/4))&1)?mixA(c,hexA(C.stripe||C.dark),.5):null,
};
/* ---------- LIMBS ---------- */
function armPart(Ad,C,O,side,back){const len=Ad.len,r=Ad.r,h=Ad.hand||'paw',g=[],p=[],l=[],deco=[];O=O||{};
 const fur=Mat(C.limb||C.fur,{hi:C.hi}),sleeve=O.sleeve,gar=O.c?CLOTH(O.k==='apron'&&O.under?O.under:O.c):null;
 if(h==='wing'){const sp=len*1.25,tri=[[0,-r],[-r*1.6,len*.6],[-r*.6,len+r*1.6],[r*1.2,len*.9],[r*1.3,len*.2]];const f=sUnion(sP(tri,1.5),sE(-r*.2,len*.85,r*1.4,r*1.2));g.push([f]);
  p.push({f:(x,y)=>y-len*.45,m:Mat(C.wing2||mixHex(C.fur,'#000000',.25))});l.push({f:(x,y)=>Math.sin(x*1.25)*1.2-.3+(y<len*.45?9:0),a:.35});if(gar&&sleeve!=='none')p.push({f:(x,y)=>y-len*.3,m:gar})}
 else if(h==='fin'){const f=sE(-r*.2,len*.55,r*1.25,len*.62,.25);g.push([f]);l.push({f:(x,y)=>Math.sin(x*1.6+y*.3)*1-.5,a:.25})}
 else{g.push([sC(0,0,0,len,r,r*.86)]);const hr=r*(h==='mitt'?1.35:1.12);const hd=sE(-r*.12,len+r*.2,hr,hr*.95);g.push([hd,'s',1.2]);
  if(h==='hoof')p.push({f:(x,y)=>y-(len+r*.2),m:Mat(C.hoof||'#3A2A22',{gloss:.6})});
  if(h==='claw'||h==='talon')deco.push(A=>{for(let i=-1;i<=1;i++)A.ell(-r*.12+i*r*.6,len+r*.2+hr*.9,.7,1.1,C.claw||'#F2EEE6')});
  if(h==='paw'||h==='mitt')l.push({f:(x,y)=>Math.max(Math.abs(x+r*.12)-.4,-(y-(len+r*.55))),a:.35});
  if(C.paw)p.push({f:hd,m:Mat(C.paw)});
  if(gar&&sleeve&&sleeve!=='none'){const sl=sleeve==='short'?len*.42:len*.86;p.push({f:(x,y)=>y-sl,m:gar});if(sleeve==='long'&&O.cuff!==false)p.push({f:(x,y)=>Math.abs(y-sl+.8)-1,m:O.cuff?CLOTH(O.cuff):CLOTH(shadeHex(O.c,.8))});l.push({f:(x,y)=>y-sl,a:.45,half:1})}}
 const pt={bb:[-len*1.4,-r*2.5,len*1.4,len+r*3],th:r*1.1,g,mat:fur,p,l,back,sh:side==='far'?-.12:0,deco:deco.length?(A=>deco.forEach(d=>d(A))):null};return pt}
function legPart(Ld,C,O,side,back){const len=Ld.len,r=Ld.r,ft=Ld.foot||'paw',g=[],p=[],l=[],deco=[];O=O||{};
 const fur=Mat(C.leg||C.fur,{hi:C.hi});
 if(Ld.digi){g.push([sE(0,len*.25,r*1.35,len*.42,.25)]);g.push([sC(r*.35,len*.55,-r*.1,len,r*.75,r*.6),'s',1.5])}
 else if(Ld.thin){g.push([sC(0,0,0,len,r*.5,r*.42)])}
 else g.push([sC(0,0,0,len,r,r*.9)]);
 if(Ld.thigh)g.push([sE(Ld.thigh<0?r*.2:-r*.1,len*.12,r*1.55,Math.max(r*1.4,len*.38)),'s',r*.8]);
 const fy=len+r*.15,fx=-r*.4;let foot;
 switch(ft){
  case 'big':foot=sE(fx-r*.9,fy,r*2.1,r*.72);break;
  case 'hoof':foot=sB(0,fy-r*.1,r*.95,r*.78,r*.3);p.push({f:(x,y)=>y-(fy-r*.35),m:Mat(C.hoof||'#3A2A22',{gloss:.6})});break;
  case 'talon':case 'claw':foot=sUnion(sC(0,fy-r*.2,-r*1.8,fy+r*.35,r*.42,r*.3),sC(0,fy-r*.2,-r*.4,fy+r*.6,r*.42,r*.3),sC(0,fy-r*.2,r*1.2,fy+r*.35,r*.4,r*.28));deco.push(A=>{A.px(-r*1.9,fy+r*.6,C.claw||'#F2EEE6');A.px(-r*.45,fy+r*.85,C.claw||'#F2EEE6')});break;
  case 'webbed':foot=sUnion(sE(fx-r*.3,fy,r*1.5,r*.6),sE(fx-r*1.4,fy+r*.15,r*.55,r*.45),sE(fx+r*.7,fy+r*.15,r*.55,r*.45));break;
  case 'sneaker':{foot=sB(fx-r*.5,fy,r*1.6,r*.8,r*.6);p.push({f:foot,m:Mat(O.shoe||'#F4F4F6',{gloss:.4})});p.push({f:sAnd(foot,(x,y)=>-(y-(fy+r*.35))),m:Mat(O.sole||'#F4F4F6')});p.push({f:sAnd(foot,(x,y)=>Math.max(-(y-(fy-r*.6)),y-(fy+r*.2),x-(fx+r*.6),-(x-(fx-r*1.6)))),m:Mat(O.shoe2||'#D9434B',{gloss:.4})});l.push({f:(x,y)=>y-(fy+r*.38),a:.55});deco.push(A=>{A.line(fx-r*1.2,fy-r*.3,fx+r*.2,fy-r*.1,O.swoosh||'#26282E')});break}
  case 'boot':foot=sUnion(sB(fx-r*.4,fy,r*1.55,r*.7,r*.5),sB(0,fy-r*1.2,r*1.0,r*1.2,r*.3));p.push({f:foot,m:Mat(O.boot||'#7A4E2A',{gloss:.5})});p.push({f:(x,y)=>Math.max(-(y-(fy+r*.45)),foot(x,y)),m:Mat('#2A1A10')});deco.push(A=>A.line(-r*.6,fy-r*1.6,r*.6,fy-r*1.3,'#F4C542'));break;
  case 'dress':foot=sE(fx-r*.6,fy,r*1.55,r*.66);p.push({f:foot,m:Mat(O.shoe||'#1E1A22',{gloss:.9})});break;
  case 'heel':foot=sP([[fx-r*1.6,fy+r*.6],[fx-r*1.2,fy-r*.4],[r*.8,fy-r*.6],[r*.9,fy+r*.6]],.5);p.push({f:foot,m:Mat(O.shoe||'#E2547A',{gloss:.9})});break;
  default:foot=sE(fx-r*.25,fy,r*1.28,r*.72);
 }
 g.push([foot,'s',1.2]);
 if(C.paw&&(ft==='paw'||ft==='big'))p.push({f:foot,m:Mat(C.paw)});
 if(ft==='paw'||ft==='big')l.push({f:(x,y)=>Math.max(Math.abs(x-(fx-r*.6))-.4,-(y-(fy-r*.1))),a:.35});
 if(O.pants){p.push({f:(x,y)=>y-(len-.5),m:CLOTH(O.pants)});deco.push(A=>{for(let y=1;y<len-1;y+=.5/A.k)A.dark(-r*.25,y,.25)})}
 if(Ld.shorts){p.push({f:(x,y)=>y-len*.5,m:CLOTH(Ld.shorts)})}
 const pt={bb:[-r*4.5,-r*1.5,r*3,len+r*2.4],th:r*1.1,g,mat:fur,p,l,back,sh:side==='far'?-.13:0,deco:deco.length?(A=>deco.forEach(d=>d(A))):null};return pt}
/* ---------- TAILS ---------- */
function tailPart(T,C){const L=T.len,g=[],p=[],l=[],deco=[],k=T.k;const fur=Mat(T.c||C.tail||C.fur,{hi:C.hi});let f;
 switch(k){
  case 'ringed':{f=sCurve([0,0],[L*.65,-L*.05],[L*.95,-L*.75],L*.2,L*.17);g.push([f]);const P=f.P;p.push({f:(x,y)=>{const t=curveT(P,x,y);return (Math.floor(t*5.5)&1)&&t>.12?-1:1},m:Mat(C.dark||'#2A2230')});p.push({f:(x,y)=>curveT(P,x,y)>.86?-1:1,m:Mat(C.dark||'#2A2230')});break}
  case 'bushy':{f=sUnion(sCurve([0,0],[L*.6,L*.05],[L*.85,-L*.7],L*.16,L*.3),sE(L*.82,-L*.72,L*.3,L*.32));g.push([f]);if(T.tip)p.push({f:sE(L*.88,-L*.88,L*.28,L*.22),m:Mat(T.tip),soft:1});l.push({f:(x,y)=>Math.sin(x*.8-y*.6)*1.4-.8,a:.2});break}
  case 'thin':{f=sCurve([0,0],[L*.7,L*.25],[L,-L*.3],1.8,1);g.push([f]);const e=sE(L*1.0,-L*.42,2.4,2.4);g.push([sAnd(e,(x,y)=>-(y+L*.35)),'u']);break}
  case 'thick':{f=sCurve([0,0],[L*.55,L*.15],[L*1.05,L*.5],L*.3,1.4);g.push([f]);if(T.ridge)deco.push(A=>{const P=f.P;for(let i=1;i<P.length-1;i++){const [x,y]=P[i];A.px(x,y-L*.3*(1-i/P.length)-.5,C.dark||'#2A3A2A')}});break}
  case 'fan':{const n=T.n||5;const fs=[];for(let i=0;i<n;i++){const a=-.15+i*(1.0/(n-1)),ex=Math.cos(a)*L,ey=Math.sin(a)*L*.9;fs.push(sC(0,0,ex,ey,1.4,L*.13))}f=sUnion(...fs);g.push([f]);p.push({f:(x,y)=>Math.hypot(x,y)-L*.72,m:Mat(T.c2||C.wing2||mixHex(C.fur,'#000000',.2))});if(T.eyes)p.push({f:(x,y)=>Math.hypot(x,y)-L*.82<0&&Math.hypot(x,y)>L*.7?-1:1,m:Mat(T.eyes)});break}
  case 'stub':{f=sE(L*.3,-L*.1,L*.45,L*.42);g.push([f]);if(T.fluff)p.push({f,m:Mat(T.c||C.fluff||C.fur,{pat:PATS.fuzz(C)})});break}
  case 'tuft':{f=sCurve([0,0],[L*.6,L*.2],[L*.95,-L*.35],1.6,1.1);g.push([f]);const t=sE(L,-L*.45,L*.17,L*.22,.4);g.push([t,'s',1]);p.push({f:t,m:Mat(T.c2||C.hair||C.dark)});break}
  case 'fin':{f=sUnion(sC(0,0,L*.55,0,L*.22,L*.1),sP([[L*.45,0],[L*1.05,-L*.55],[L*.82,0],[L*1.0,L*.45]],1));g.push([f]);break}
  case 'fluke':{f=sUnion(sC(0,0,L*.6,-L*.1,L*.25,L*.12),sP([[L*.5,-L*.1],[L*1.0,-L*.6],[L*.9,-L*.1],[L*1.05,L*.25]],1.2));g.push([f]);break}
  case 'swan':{f=sP([[0,-L*.2],[L*.8,-L*.55],[L*.6,L*.2],[0,L*.25]],1.5);g.push([f]);l.push({f:(x,y)=>Math.sin(y*1.2)*1-.4,a:.25});break}
  case 'flame':{f=sCurve([0,0],[L*.6,L*.25],[L*.95,-L*.2],L*.22,L*.1);g.push([f]);const fl=sUnion(sE(L*.98,-L*.45,L*.2,L*.32),sE(L*1.08,-L*.75,L*.1,L*.2));g.push([fl,'s',2]);p.push({f:fl,m:Mat('#FFB02E',{flat:1,c2:'#FF4A2E',grad:[L,-L,L,-L*.2]})});break}
  case 'curl':{f=sCurve([0,0],[L*.9,-L*.1],[L*.6,-L*.8],2.4,1.6);g.push([f]);break}
  case 'kanga':{f=sCurve([0,0],[L*.5,L*.45],[L*1.1,L*.62],L*.26,L*.08);g.push([f]);break}
  case 'snail':{f=sE(0,0,1,1);break}
  default:f=sE(L*.3,0,L*.35,L*.25);g.push([f]);
 }
 const pt={bb:[-L*.6,-L*1.3,L*1.5,L*1.0],th:Math.max(2,L*.18),g,mat:fur,p,l,deco:deco.length?(A=>deco.forEach(d=>d(A))):null};return pt}
/* ---------- WINGS (drawn as screen-left wing; mirrored with sd) ---------- */
function wingPart(Wd,C,sd,back){const S=Wd.span,k=Wd.k||'bird',g=[],p=[],l=[],deco=[],X=x=>x*sd;
 const c1=Wd.c||C.wing||C.fur,c2=Wd.c2||C.wing2||mixHex(c1,'#000000',.25);let mat=Mat(c1,{hi:.55}),a=null,ol=true;
 if(k==='bird'||k==='jet'){const tip=[X(-S),-S*.62],pts=[[X(S*.05),-S*.08],[X(-S*.3),-S*.5],tip,[X(-S*.86),-S*.35],[X(-S*.55),S*.05],[X(-S*.18),S*.22],[X(S*.08),S*.1]];g.push([sP(pts,1.6)]);
  const fs=[];for(let i=0;i<5;i++){const t=i/4,bx=X(-S*(.95-.75*t)),by=-S*(.5-.62*t);fs.push(sE(bx,by+S*.06,S*.13,S*.1))}g.push([sUnion(...fs),'s',1.5]);
  p.push({f:(x,y)=>(-y*1.1+sd*x*.7)-S*.3<0&&y>-S*.6?-1:1,m:Mat(c2,{c2:Wd.c3,grad:Wd.c3?[0,0,X(-S),-S*.6]:null})});
  l.push({f:(x,y)=>Math.sin((x*sd*-1)*.9+y*.4)*1.3-.4+((-y*1.1+sd*x*.7)-S*.3<0?0:9),a:.3});
  if(k==='jet')p.push({f:(x,y)=>Math.abs((-y*1.1+sd*x*.7)-S*.42)-1.2,m:Mat(Wd.stripe||'#3E6FB0')})}
 if(k==='bat'||k==='ptero'){const tip=[X(-S),-S*.72];const arm=sUnion(sC(0,0,X(-S*.45),-S*.55,S*.07,S*.05),sC(X(-S*.45),-S*.55,tip[0],tip[1],S*.05,S*.03));
  const mem=sP([[X(S*.04),-S*.05],[X(-S*.45),-S*.55],tip,[X(-S*.82),-S*.28],[X(-S*.6),-S*.08],[X(-S*.38),S*.05],[X(-S*.12),S*.12]],.5);
  const cuts=sUnion(sE(X(-S*.74),-S*.16,S*.12,S*.1),sE(X(-S*.5),S*.04,S*.12,S*.08),sE(X(-S*.25),S*.15,S*.1,S*.07));
  g.push([sAnd(mem,sNot(cuts))]);g.push([arm]);p.push({f:sAnd(mem,(x,y)=>-arm(x,y)+.2),m:Mat(c2,{c2:Wd.c3,grad:Wd.c3?[0,0,X(-S),-S*.3]:null}),soft:.6});
  [[-S*.9,-S*.4],[-S*.65,-S*.12],[-S*.4,S*.06]].forEach(([fx,fy])=>{const f=sC(X(-S*.45),-S*.55,X(fx),fy,S*.03,.5);g.push([f]);l.push({f,a:.3})})}
 if(k==='insect'){a=.55;ol=true;const f1=sE(X(-S*.55),-S*.42,S*.55,S*.17,sd*.6),f2=sE(X(-S*.45),-S*.05,S*.42,S*.14,sd*.15);g.push([f1],[f2]);
  mat=Mat(c1,{a:.62,c2:c2,grad:[0,0,X(-S),-S*.5],flat:1,gloss:.6});l.push({f:(x,y)=>Math.sin((x*sd)*.7-y*1.1)*1.5-.9,a:.2})}
 if(k==='moth'){const f1=sE(X(-S*.55),-S*.4,S*.55,S*.38,sd*.55),f2=sE(X(-S*.4),S*.12,S*.38,S*.3,sd*-.2);g.push([f1],[f2,'s',2]);
  mat=Mat(c1,{c2:c2,rad:[0,0,S*1.05],pat:PATS.fuzz(C)});const sp=Wd.spot||'#FFFFFF';
  p.push({f:sE(X(-S*.62),-S*.48,S*.17,S*.16),m:Mat(Wd.ring||'#16203A')});p.push({f:sE(X(-S*.62),-S*.48,S*.11,S*.1),m:Mat(sp,{flat:1})});p.push({f:sE(X(-S*.62),-S*.48,S*.05,S*.05),m:Mat(Wd.pupil||'#2E6FE8',{flat:1})});
  p.push({f:sE(X(-S*.42),S*.14,S*.09,S*.08),m:Mat(sp,{flat:1})});
  l.push({f:sAnd(f1,(x,y)=>-(f1(x,y)+S*.08)),a:.3})}
 if(k==='fin'){const f=sP([[X(S*.05),-S*.05],[X(-S*.7),-S*.35],[X(-S),S*.08],[X(-S*.35),S*.3]],1.2);g.push([f]);l.push({f:(x,y)=>Math.sin(Math.atan2(y,x*sd)*9)*2-.5,a:.25})}
 if(k==='puff'){const f=sE(X(-S*.45),0,S*.5,S*.3,sd*-.3);g.push([f]);mat=Mat(c1,{a:.7,flat:1})}
 const pt={bb:[sd<0?-S*.4:-S*1.3,-S*1.1,sd<0?S*1.3:S*.4,S*.6],th:S*.12,g,mat,p,l,ol,back,rim:.6,sh:Wd.far?-.14:0,deco:deco.length?(A=>deco.forEach(d=>d(A))):null};return pt}
