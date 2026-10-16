/* ================= BEAST ENGINE v4: shape-rasterized, gradient-lit creature parts on skeletons ================= */
const hexA=h=>{if(Array.isArray(h))return h;const n=parseInt(h.slice(1,7),16);return [(n>>16)&255,(n>>8)&255,n&255]};
const mixA=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const B4=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5],bay4=(x,y)=>(B4[(x&3)|((y&3)<<2)]+.5)/16;
const INK=[24,14,40],COOL=[46,30,96],WARM=[255,244,214],RIMC=[186,232,255];
let BGOLD=0;
function mixHex(a,b,t){const c=mixA(hexA(a),hexA(b),t);return '#'+c.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('')}
const hsh=(x,y,s=0)=>{const v=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453;return v-Math.floor(v)};
function goldify(h){const c=hexA(h),l=(c[0]*.3+c[1]*.59+c[2]*.11)/255;return mixA(mixA([120,74,14],[255,236,150],Math.min(1,.12+l*1.2)),c,.12)}
function ramp(h,hi=.5){const b=hexA(h),sh=mixA(mixA(b,[0,0,0],.58),COOL,.4),w=mixA(b,WARM,hi),r=[];for(let i=0;i<8;i++){const t=i/7;r.push(t<.56?mixA(sh,b,Math.pow(t/.56,.85)):mixA(b,w,(t-.56)/.44))}return r}
function Mat(c,o={}){o=Object.assign({},o);if(BGOLD&&!o.keep){c=goldify(c);if(o.c2)o.c2=goldify(o.c2);o.gloss=Math.max(o.gloss||0,.55)}o.r=ramp(c,o.hi);if(o.c2)o.r2=ramp(o.c2,o.hi);return o}
/* ---- signed distance primitives (design units, y down) ---- */
const sE=(cx,cy,rx,ry,a=0)=>{const c=Math.cos(a),s=Math.sin(a),m=Math.min(rx,ry);return (x,y)=>{let u=x-cx,v=y-cy;if(a){const t=u*c+v*s;v=-u*s+v*c;u=t}const k0=Math.hypot(u/rx,v/ry);if(k0<1e-6)return -m;const k1=Math.hypot(u/(rx*rx),v/(ry*ry));return k0*(k0-1)/k1}};
const sC=(ax,ay,bx,by,ra,rb=ra)=>{const bax=bx-ax,bay=by-ay,L2=bax*bax+bay*bay||1e-6;return (x,y)=>{const pax=x-ax,pay=y-ay,h=clamp((pax*bax+pay*bay)/L2,0,1);return Math.hypot(pax-bax*h,pay-bay*h)-(ra+(rb-ra)*h)}};
const sB=(cx,cy,hw,hh,r=0,a=0)=>{const c=Math.cos(a),s=Math.sin(a);return (x,y)=>{let u=x-cx,v=y-cy;if(a){const t=u*c+v*s;v=-u*s+v*c;u=t}const qx=Math.abs(u)-hw+r,qy=Math.abs(v)-hh+r;return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-r}};
const sP=(v,r=0)=>(x,y)=>{let d=(x-v[0][0])**2+(y-v[0][1])**2,s=1;for(let i=0,j=v.length-1;i<v.length;j=i,i++){const ex=v[j][0]-v[i][0],ey=v[j][1]-v[i][1],wx=x-v[i][0],wy=y-v[i][1],h=clamp((wx*ex+wy*ey)/(ex*ex+ey*ey||1e-6),0,1),bx=wx-ex*h,by=wy-ey*h;d=Math.min(d,bx*bx+by*by);const c1=y>=v[i][1],c2=y<v[j][1],c3=ex*wy>ey*wx;if((c1&&c2&&c3)||(!c1&&!c2&&!c3))s=-s}return s*Math.sqrt(d)-r};
function bez(p0,p1,p2,n=8){const P=[];for(let i=0;i<=n;i++){const t=i/n,a=(1-t)*(1-t),b=2*(1-t)*t,c=t*t;P.push([a*p0[0]+b*p1[0]+c*p2[0],a*p0[1]+b*p1[1]+c*p2[1],t])}return P}
function sCurve(p0,p1,p2,r0,r1,n=8){const P=bez(p0,p1,p2,n),S=[];for(let i=0;i<n;i++)S.push(sC(P[i][0],P[i][1],P[i+1][0],P[i+1][1],r0+(r1-r0)*i/n,r0+(r1-r0)*(i+1)/n));const f=(x,y)=>{let d=1e9;for(const g of S){const e=g(x,y);if(e<d)d=e}return d};f.P=P;return f}
function curveT(P,x,y){let best=1e9,bt=0;for(let i=0;i<P.length-1;i++){const [ax,ay]=P[i],[bx,by]=P[i+1],ex=bx-ax,ey=by-ay,h=clamp(((x-ax)*ex+(y-ay)*ey)/(ex*ex+ey*ey||1e-6),0,1),d=Math.hypot(x-ax-ex*h,y-ay-ey*h);if(d<best){best=d;bt=P[i][2]+(P[i+1][2]-P[i][2])*h}}return bt}
const sUnion=(...fs)=>(x,y)=>{let d=1e9;for(const f of fs){const e=f(x,y);if(e<d)d=e}return d};
const sNot=f=>(x,y)=>-f(x,y);
const sAnd=(a,b)=>(x,y)=>Math.max(a(x,y),b(x,y));
const ALL=()=>-1;
/* ---- rasterizer ---- */
function bake(pt,k,variants){
 const m=3,x0=Math.floor(pt.bb[0]*k)-m,y0=Math.floor(pt.bb[1]*k)-m,W=Math.ceil(pt.bb[2]*k)+m-x0,H=Math.ceil(pt.bb[3]*k)+m-y0,N=W*H;
 const D=new Float32Array(N),Hh=new Float32Array(N),Mi=new Uint8Array(N),paint=pt.p||[],mats=[pt.mat].concat(paint.map(p=>p.m)),th=(pt.th||6)*k,TH=.3;
 for(let j=0;j<H;j++)for(let i=0;i<W;i++){const X=(x0+i+.5)/k,Y=(y0+j+.5)/k;let d=1e9;
  for(const g of pt.g){const e=g[0](X,Y),op=g[1];if(!op||op==='u'){if(e<d)d=e}else if(op==='s'){const kk=g[2]||2,h=Math.max(kk-Math.abs(d-e),0)/kk;d=Math.min(d,e)-h*h*kk/4}else if(op==='x')d=Math.max(d,-e);else if(op==='i')d=Math.max(d,e)}
  d*=k;const q=j*W+i;D[q]=d;if(d>=TH)continue;
  const u=Math.min(1,(-d+TH)/th);let hgt=th*Math.sqrt(1-(1-u)*(1-u)),mi=0;
  for(let p=0;p<paint.length;p++){const P=paint[p];if(P.bk!=null&&!!P.bk!==!!pt.back)continue;const e=P.f(X,Y)*k,soft=(P.soft||0)*k;
   if(e<0||(soft&&e<soft&&bay4(i,j)<1-e/soft)){if(P.m)mi=p+1;if(P.bump)hgt+=P.bump*k*Math.min(1,-e/(Math.max(1,P.bump*k*1.5)))}}
  Hh[q]=hgt;Mi[q]=mi}
 const out=new Uint8ClampedArray(N*4),L=[-.52,-.62,.6],ln=Math.hypot(L[0],L[1],L[2]),Hv=[L[0]/ln,L[1]/ln,L[2]/ln+1],hl=Math.hypot(Hv[0],Hv[1],Hv[2]);
 const sh=pt.sh||0,rimK=pt.rim==null?1:pt.rim,bb=pt.bb;
 for(let j=0;j<H;j++)for(let i=0;i<W;i++){const q=j*W+i;if(D[q]>=TH)continue;const X=(x0+i+.5)/k,Y=(y0+j+.5)/k;
  const a=i>0?Hh[q-1]:0,b=i<W-1?Hh[q+1]:0,c=j>0?Hh[q-W]:0,e=j<H-1?Hh[q+W]:0;let nx=(a-b)/2,ny=(c-e)/2,nz=1;const nl=Math.hypot(nx,ny,nz);nx/=nl;ny/=nl;nz/=nl;
  const M=mats[Mi[q]]||pt.mat;let dif=(nx*L[0]+ny*L[1]+nz*L[2])/ln;if(M.flat)dif=.62+(dif-.62)*.25;
  let t=.6+.74*(dif-.62)+sh+(M.sh||0);if(pt.ao){const yy=(Y-bb[1])/(bb[3]-bb[1]);t-=pt.ao*clamp((yy-.55)/.45,0,1)}
  // Four deliberate cel-shaded bands, without noisy dithering.
  const qi=[1,3,5,7][clamp(Math.floor(t*4),0,3)];
  let col;if(M.r2){let s;if(M.rad){const [gx,gy,gr]=M.rad;s=Math.round(clamp(Math.hypot(X-gx,Y-gy)/gr,0,1)*3)/3}else{const [gx0,gy0,gx1,gy1]=M.grad,ex=gx1-gx0,ey=gy1-gy0;s=Math.round(clamp(((X-gx0)*ex+(Y-gy0)*ey)/(ex*ex+ey*ey||1),0,1)*3)/3}col=mixA(M.r[qi],M.r2[qi],s)}else col=M.r[qi];
  if(M.pat){const pc=M.pat(X,Y,qi,i,j,col);if(pc)col=pc}
  const rim=(nx*.9-ny*.2)-nz*.42;if(rim>.34&&!M.flat)col=mixA(col,RIMC,.22*rimK);
  if(M.gloss){const sp=(nx*Hv[0]+ny*Hv[1]+nz*Hv[2])/hl;if(sp>.965)col=mixA(col,[255,255,255],M.gloss);else if(sp>.94)col=mixA(col,[255,255,255],M.gloss*.3)}
  const o=q*4;out[o]=col[0];out[o+1]=col[1];out[o+2]=col[2];out[o+3]=Math.round((M.a==null?1:M.a)*255)}
 for(const Ln of pt.l||[]){if(Ln.bk!=null&&!!Ln.bk!==!!pt.back)continue;const F=new Float32Array(N);for(let j=0;j<H;j++)for(let i=0;i<W;i++)F[j*W+i]=Ln.f((x0+i+.5)/k,(y0+j+.5)/k);
  const col=Ln.c?hexA(Ln.c):null,amt=Ln.a||.5;
  for(let j=1;j<H-1;j++)for(let i=1;i<W-1;i++){const q=j*W+i;if(D[q]>=TH||F[q]>0)continue;if(F[q-1]>0||F[q+1]>0||F[q-W]>0||F[q+W]>0){if(Ln.half&&F[q-W]>0&&F[q+W]<=0&&F[q-1]<=0&&F[q+1]<=0)continue;const o=q*4,cc=col||mixA([out[o],out[o+1],out[o+2]],INK,amt);out[o]=cc[0];out[o+1]=cc[1];out[o+2]=cc[2]}}}
 if(pt.ol!==false){const add=[];for(let j=0;j<H;j++)for(let i=0;i<W;i++){const q=j*W+i;if(out[q*4+3]>0&&D[q]<TH)continue;
   let nb=-1,lit=0;if(i<W-1&&D[q+1]<TH&&out[(q+1)*4+3]>40){nb=q+1;lit=1}else if(j<H-1&&D[q+W]<TH&&out[(q+W)*4+3]>40){nb=q+W;lit=1}else if(i>0&&D[q-1]<TH&&out[(q-1)*4+3]>40)nb=q-1;else if(j>0&&D[q-W]<TH&&out[(q-W)*4+3]>40)nb=q-W;
   if(nb>=0){const o=nb*4,cc=mixA([out[o],out[o+1],out[o+2]],INK,lit?.74:.9);add.push([q,cc])}}
  add.forEach(([q,cc])=>{const o=q*4;out[o]=cc[0];out[o+1]=cc[1];out[o+2]=cc[2];out[o+3]=255})}
 const mk=buf=>{const c=cnv(W,H);c.getContext('2d').putImageData(new ImageData(buf,W,H),0,0);return c};
 const res={ox:x0,oy:y0,W,H};
 if(pt.deco||variants){const vs=variants||{idle:null};res.v={};for(const name in vs){const buf=new Uint8ClampedArray(out);const A=decoAPI(buf,W,H,x0,y0,k,D);if(pt.deco)pt.deco(A,name);if(vs[name])vs[name](A,name);res.v[name]=mk(buf)}res.c=res.v.idle||res.v[Object.keys(res.v)[0]]}
 else res.c=mk(out);
 return res}
function decoAPI(buf,W,H,x0,y0,k,D){
 const put=(i,j,c,a=1)=>{if(i<0||j<0||i>=W||j>=H)return;const q=(j*W+i)*4,C=hexA(c);if(a>=1){buf[q]=C[0];buf[q+1]=C[1];buf[q+2]=C[2];buf[q+3]=255}else{const al=buf[q+3]/255;buf[q]+=(C[0]-buf[q])*a;buf[q+1]+=(C[1]-buf[q+1])*a;buf[q+2]+=(C[2]-buf[q+2])*a;buf[q+3]=Math.max(buf[q+3],a*255)}};
 const I=x=>Math.floor(x*k)-x0,J=y=>Math.floor(y*k)-y0;
 const A={k,
  px(x,y,c,a){put(I(x),J(y),c,a)},
  pix(i,j,c,a){put(i,j,c,a)},
  ell(cx,cy,rx,ry,c,a,clip){const i0=I(cx-rx)-1,i1=I(cx+rx)+1,j0=J(cy-ry)-1,j1=J(cy+ry)+1;for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const X=(i+x0+.5)/k,Y=(j+y0+.5)/k;if(((X-cx)/rx)**2+((Y-cy)/ry)**2<=1&&(!clip||A.inPix(i,j)))put(i,j,c,a)}},
  ring(cx,cy,rx,ry,w,c,a){const i0=I(cx-rx-w)-1,i1=I(cx+rx+w)+1,j0=J(cy-ry-w)-1,j1=J(cy+ry+w)+1;for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const X=(i+x0+.5)/k,Y=(j+y0+.5)/k,d=Math.hypot((X-cx)/rx,(Y-cy)/ry);if(Math.abs(d-1)*Math.min(rx,ry)<w/2+.5/k)put(i,j,c,a)}},
  rect(x,y,w,h,c,a){for(let j=J(y);j<J(y+h);j++)for(let i=I(x);i<I(x+w);i++)put(i,j,c,a)},
  shape(f,c,a,clip){for(let j=0;j<H;j++)for(let i=0;i<W;i++){if(clip&&!A.inPix(i,j))continue;if(f((i+x0+.5)/k,(j+y0+.5)/k)<0)put(i,j,c,a)}},
  line(xa,ya,xb,yb,c,a){let i=I(xa),j=J(ya);const i1=I(xb),j1=J(yb),di=Math.abs(i1-i),dj=-Math.abs(j1-j),si=i<i1?1:-1,sj=j<j1?1:-1;let er=di+dj;for(let n=0;n<400;n++){put(i,j,c,a);if(i===i1&&j===j1)break;const e2=2*er;if(e2>=dj){er+=dj;i+=si}if(e2<=di){er+=di;j+=sj}}},
  dark(x,y,f=.5){const i=I(x),j=J(y);if(i<0||j<0||i>=W||j>=H)return;const q=(j*W+i)*4;if(!buf[q+3])return;const c=mixA([buf[q],buf[q+1],buf[q+2]],INK,f);buf[q]=c[0];buf[q+1]=c[1];buf[q+2]=c[2]},
  get(x,y){const i=I(x),j=J(y);if(i<0||j<0||i>=W||j>=H)return null;const q=(j*W+i)*4;return buf[q+3]?[buf[q],buf[q+1],buf[q+2]]:null},
  inPix(i,j){return i>=0&&j>=0&&i<W&&j<H&&D[j*W+i]<.3},
  ins(x,y){return A.inPix(I(x),J(y))}};
 return A}
/* ---- matrices ---- */
const mMul=(m,n)=>[m[0]*n[0]+m[2]*n[1],m[1]*n[0]+m[3]*n[1],m[0]*n[2]+m[2]*n[3],m[1]*n[2]+m[3]*n[3],m[0]*n[4]+m[2]*n[5]+m[4],m[1]*n[4]+m[3]*n[5]+m[5]];
const mT=(x,y)=>[1,0,0,1,x,y],mR=a=>{const c=Math.cos(a),s=Math.sin(a);return [c,s,-s,c,0,0]},mS=(x,y)=>[x,0,0,y,0,0];
/* ---- skeleton drawing ---- */
function drawRig(ctx,R,P,view){const back=view==='back',k=R.k,A=R.anim(P,back)||{};const root=A.root||{};
 let M=mT(R.cx,R.base);if(back)M=mMul(M,mS(-1,1));
 M=mMul(M,mT(((P.x||0)+(root.dx||0))*k,((P.y||0)+(root.dy||0))*k));if(P.r||root.r){const pv=R.tipX||0;M=mMul(M,mT(pv*k,0));M=mMul(M,mR((P.r||0)+(root.r||0)));M=mMul(M,mT(-pv*k,0))}
 M=mMul(M,mS((P.sx||1)*(root.sx||1),(P.sy||1)*(root.sy||1)));
 const W={root:M},list=[];
 for(const b of R.bones){const pm=W[b.par||'root']||M,a=A[b.n]||{};if(a.hide){W[b.n]=pm;continue}
  let m=mMul(pm,mT(b.at[0]*k,b.at[1]*k));if(a.dx||a.dy)m=mMul(m,mT((a.dx||0)*k,(a.dy||0)*k));const r=(b.rr||0)+(a.r||0);if(r)m=mMul(m,mR(r));if(a.sx||a.sy)m=mMul(m,mS(a.sx||1,a.sy||1));W[b.n]=m;
  const img=back&&b.imgB?b.imgB:b.img;if(!img||(back&&b.hideB))continue;const z=back&&b.zb!=null?b.zb:b.z;list.push([z,m,img,a.v||(b.face?P.face:null),a.al]) }
 list.sort((p,q)=>p[0]-q[0]);
 for(const [z,m,img,v,al] of list){const c=v&&img.v?(img.v[v]||img.v.idle||img.c):img.c;ctx.setTransform(m[0],m[1],m[2],m[3],Math.round(m[4]),Math.round(m[5]));if(al!=null)ctx.globalAlpha=al;ctx.drawImage(c,img.ox,img.oy);if(al!=null)ctx.globalAlpha=1}
 ctx.setTransform(1,0,0,1,0,0)}
function rigTint(ctx,w,h,col,a){if(a<=0)return;ctx.save();ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=Math.min(1,a);ctx.fillStyle=col;ctx.fillRect(0,0,w,h);ctx.restore()}
const sm=x=>x*x*(3-2*x);
/* ---- shared pose channels (design space faces left: forward is -x) ---- */
function rigPose(act,tau,t,seed){const P={act,tau,t,seed,x:0,y:0,r:0,sx:1,sy:1,body:0,bdy:0,head:0,hdx:0,hdy:0,aL:0,aR:0,lL:0,lR:0,tail:0,flap:1,open:0,face:'idle',hov:{dx:0,dy:0,r:0},k:0};
 const ph=(a,b)=>clamp((tau-a)/(b-a),0,1);
 const br=Math.sin(t/640+seed);P.sy=1+.018*br;P.sx=1-.01*br;P.hdy=br>.45?-.6:0;P.head=.05*Math.sin(t/1400+seed*2);
 P.aL=.07*Math.sin(t/800+seed);P.aR=-.07*Math.sin(t/800+seed+1.2);P.tail=.16*Math.sin(t/560+seed);
 P.hov.dy=Math.sin(t/480+seed)*2;P.hov.r=.08*Math.sin(t/900+seed);
 if((t+seed*997)%4300<130)P.face='blink';
 const lk=(t+seed*1500)%9000;if(lk<700){P.head+=.13*Math.sin(lk/700*Math.PI);if(lk>200&&lk<520)P.face='happy'}
 switch(act){
  case 'attack':{const w=sm(ph(0,150)),s=sm(ph(150,240)),r=sm(ph(300,580)),q=1-r;P.k=s*q;
   P.x=(3*w-12*s)*q;P.body=(.1*w-.3*s)*q;P.head+=(.08*w-.2*s)*q;P.aL+=(-.7*w+2.3*s)*q;P.aR+=(.4*w-.6*s)*q;P.lL=.3*s*q;P.lR=-.2*s*q;P.tail+=.6*s*q;P.flap=1+2*s*q;P.open=s*q;if(s>.15&&r<.6)P.face='shout';break}
  case 'cast':{const u=sm(ph(0,220)),r=sm(ph(560,820)),q=u*(1-r);P.k=q;P.aL+=(2.4+.25*Math.sin(tau/70))*q;P.aR-=(2.4+.25*Math.sin(tau/70+1))*q;P.hdy-=2*q;P.head*=1-q;P.bdy=-q;P.y=-2*q*Math.abs(Math.sin(tau/160));P.flap=1+1.6*q;P.open=q*.6;if(q>.3)P.face='shout';break}
  case 'hurt':{const e=Math.exp(-tau/150)*(tau<700?1:0);P.k=e;P.x=5*e;P.head+=.4*e;P.body=.2*e;P.aL+=1*e*Math.sin(tau/38);P.aR-=1*e*Math.sin(tau/38+1);P.hdx=2*e;P.tail-=.5*e;if(tau<520)P.face='hurt';break}
  case 'faint':{const q=sm(ph(0,650)),w=sm(ph(0,160));P.k=q;P.r=1.2*sm(ph(120,620));P.body=-.1*w;P.head=.35*q;P.lL=-.3*q;P.lR=.15*q;P.aL=-.9*q;P.aR=1.1*q;P.flap=1-q;P.fall=sm(ph(80,600));P.face='hurt';break}
  case 'cheer':{const q=tau<900?1:0;P.k=q;P.aL+=(2.2+.35*Math.sin(tau/75))*q;P.aR-=(2.2+.35*Math.sin(tau/75+1.4))*q;P.y=-Math.abs(Math.sin(tau/150*Math.PI/2))*6*q;P.flap=1+q;P.tail+=.5*Math.sin(tau/60)*q;if(q)P.face='happy';break}
  case 'buff':{const q=tau<760?sm(ph(0,140)):0,pump=Math.sin(tau/95)*.3;P.k=q;P.aL+=(1.9+pump)*q;P.aR-=(1.9+pump)*q;P.bdy=-q;P.hdy-=q;P.sx*=1+.05*q;P.sy*=1+.04*q;if(q)P.face='happy';break}
  case 'block':{const q=tau<700?sm(ph(0,120)):0;P.k=q;P.aL+=1.3*q;P.aR+=1.1*q;P.hdy+=q;P.body=.06*q;P.sy*=1-.04*q;break}
  case 'dizzy':{const q=tau<800?1:0;P.k=q;P.head+=.28*Math.sin(tau/85)*q;P.body=.07*Math.sin(tau/120)*q;P.aL+=.3*Math.sin(tau/90)*q;P.aR-=.3*Math.sin(tau/90+2)*q;if(q)P.face='hurt';break}
  case 'enter':{const q=1-sm(ph(100,600));P.k=q;P.aL+=1.2*q;P.aR-=1.2*q;P.flap=1+q;if(tau<500)P.face='happy';break}
  case 'smug':{const q=tau<1000?1:0;P.k=q;P.aL+=(2.2+.3*Math.sin(tau/70))*q;P.head-=.15*q;if(q)P.face='happy';break}
 }
 return P}
