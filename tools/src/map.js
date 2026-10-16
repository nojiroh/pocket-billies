/* ================= WORLD MAP v4: the inside of a sphere, raycast in pixels ================= */
const MW=176,MH=232,TW=1536,TH=768,D2R=Math.PI/180;
const MLL=[[0,0],[9,4],[17,-3],[25,5],[34,0],[43,-6],[51,1],[59,6],[68,0],[84,9],[100,-7],[117,11],[135,-3],[153,7],[170,-1]];
const llv=(lon,lat)=>{lon*=D2R;lat*=D2R;return [Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)]};
const v3={add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul:(a,k)=>[a[0]*k,a[1]*k,a[2]*k],dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
 cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len:a=>Math.hypot(a[0],a[1],a[2]),norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l]}};
function slerp(a,b,t){const d=clamp(v3.dot(a,b),-1,1),w=Math.acos(d);if(w<1e-5)return a;const s=Math.sin(w);return v3.add(v3.mul(a,Math.sin((1-t)*w)/s),v3.mul(b,Math.sin(t*w)/s))}
const MNV=MLL.map(([a,b])=>llv(a,b));
const MREG=ROUTE.map((r,i)=>({t:r.t,v:MNV[i],r:r.town?4.6:5.6})).concat(FUTURE.slice(0,6).map((f,i)=>({t:f.t,v:MNV[ROUTE.length+i],r:f.t==='trench'?9:6.5})));
/* route path on the sphere */
const MSEG=[];for(let i=0;i<MNV.length-1;i++){const a=MNV[i],b=MNV[i+1],nrm=v3.norm(v3.cross(a,b)),pts=[];let len=0,prev=null;
 for(let k=0;k<=40;k++){const t=k/40;let p=slerp(a,b,t);p=v3.norm(v3.add(p,v3.mul(nrm,Math.sin(t*Math.PI)*.035*(i%2?1:-1))));if(prev)len+=v3.len(v3.sub(p,prev));pts.push({p,l:len});prev=p}MSEG.push({pts,len})}
const SEGSTART=[0];MSEG.forEach((s,i)=>SEGSTART.push(SEGSTART[i]+s.len));
function gdist(node,prog){if(node>=LAST)return SEGSTART[LAST];const f=clamp(prog/ROUTE[node+1].cost,0,1);return SEGSTART[node]+f*MSEG[node].len}
function posAtG(g){let i=0;while(i<MSEG.length-1&&g>SEGSTART[i+1])i++;const s=MSEG[i],l=clamp(g-SEGSTART[i],0,s.len);let k=1;while(k<s.pts.length-1&&s.pts[k].l<l)k++;
 const p0=s.pts[k-1],p1=s.pts[k],f=(l-p0.l)/((p1.l-p0.l)||1);return v3.norm(v3.add(v3.mul(p0.p,1-f),v3.mul(p1.p,f)))}
/* noise */
function h3(x,y,z){let h=Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(z,1274126177);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296}
function vn3(x,y,z){const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),fx=x-xi,fy=y-yi,fz=z-zi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),w=fz*fz*(3-2*fz),L=(a,b,t)=>a+(b-a)*t;
 return L(L(L(h3(xi,yi,zi),h3(xi+1,yi,zi),u),L(h3(xi,yi+1,zi),h3(xi+1,yi+1,zi),u),v),L(L(h3(xi,yi,zi+1),h3(xi+1,yi,zi+1),u),L(h3(xi,yi+1,zi+1),h3(xi+1,yi+1,zi+1),u),v),w)}
function fbm3(p,f,o){let s=0,a=.5,n=0;for(let i=0;i<o;i++){s+=a*vn3(p[0]*f,p[1]*f,p[2]*f);n+=a;a*=.5;f*=2.03}return s/n}
/* biome palettes [low, mid, high] */
const BIO={wild:[[86,150,74],[104,170,84],[136,190,98]],forest:[[40,96,56],[52,116,64],[70,136,76]],hills:[[128,150,90],[150,164,104],[178,176,124]],desert:[[214,178,122],[228,194,140],[240,212,160]],snow:[[214,222,236],[232,238,246],[250,252,255]],sea:[[40,96,170],[52,118,190],[72,140,206]],
 town:[[156,196,110],[172,206,120],[190,214,134]],grass:[[70,140,64],[82,156,72],[98,172,84]],golf:[[150,214,118],[166,224,132],[182,232,148]],thicket:[[30,72,40],[42,92,50],[56,110,62]],grotto:[[70,58,50],[86,72,62],[104,88,74]],canyon:[[196,128,84],[214,150,100],[230,172,120]],
 bins:[[200,190,170],[214,206,190],[228,222,208]],food:[[232,206,170],[240,218,186],[246,230,204]],mall:[[150,150,170],[176,176,196],[206,206,222]],feedl:[[208,108,156],[124,196,156],[226,140,180]],silicon:[[60,150,200],[90,180,220],[180,234,255]],spore:[[110,70,150],[132,86,170],[160,110,196]],
 trench:[[18,48,110],[26,64,136],[36,84,160]],vault:[[170,136,70],[196,160,86],[226,192,110]],spire:[[110,116,130],[132,138,152],[160,166,180]]};
const WTX={T:null,row:0,regs:null,boost:null,done:false};
function wtexInit(){if(WTX.T)return;WTX.T=new Uint32Array(TW*TH);WTX.regs=MREG.map(r=>({t:r.t,v:r.v,c:Math.cos(r.r*D2R)}));
 const BW=384,BH=192,B=new Float32Array(BW*BH);MSEG.forEach(sg=>sg.pts.forEach(q=>{const p=q.p,lat=Math.asin(clamp(p[1],-1,1)),lon=(Math.atan2(p[2],p[0])+Math.PI*2)%(Math.PI*2),cx=lon/(Math.PI*2)*BW,cy=(.5-lat/Math.PI)*BH;
  for(let j=-6;j<=6;j++)for(let i=-6;i<=6;i++){const d=Math.hypot(i,j)/6;if(d>1)continue;const X=((Math.round(cx+i))%BW+BW)%BW,Y=clamp(Math.round(cy+j),0,BH-1);B[Y*BW+X]=Math.max(B[Y*BW+X],1-d)}}));WTX.boost=B}
function wtexRows(n){wtexInit();const T=WTX.T,regs=WTX.regs,B=WTX.boost;const end=Math.min(TH,WTX.row+n);
 for(let y=WTX.row;y<end;y++){const lat=(.5-(y+.5)/TH)*Math.PI,cl=Math.cos(lat),sl=Math.sin(lat),by=Math.min(191,Math.floor((y+.5)/TH*192));for(let x=0;x<TW;x++){const lon=(x+.5)/TW*Math.PI*2,v=[cl*Math.cos(lon),sl,cl*Math.sin(lon)];
  let h=fbm3(v,2.2,4),m=fbm3(v,6.5,2);const bo=B[by*384+Math.floor((x+.5)/TW*384)];if(bo>0)h+=bo*.22;
  let biome='sea';if(h>.5)biome=Math.abs(lat)>1.12?'snow':m>.62?'forest':m<.36?'desert':h>.64?'hills':'wild';
  let rb=null,rd=-1;for(const r of regs){const d=v3.dot(v,r.v);if(d>r.c-.002*Math.sin(lon*80+lat*60)&&d>rd){rd=d;rb=r.t}}if(rb){biome=rb==='town'?'town':rb;if(rb==='trench')h=.3}
  const P=BIO[biome]||BIO.wild,dh=fbm3([v[0]+.005,v[1]+.007,v[2]],2.2,3)-fbm3(v,2.2,3),sh=clamp(.5+dh*24,0,1);let c=sh>.62?P[2]:sh<.38?P[0]:P[1];
  if(biome==='sea'){c=mixA(BIO.sea[1],BIO.sea[0],clamp((.5-h)*5,0,1));if(h>.47)c=mixA(c,[220,214,170],.6)}
  if(biome==='golf'&&((x>>2)+(y>>2))&1)c=mixA(c,[255,255,255],.08);if(biome==='canyon'&&(y>>1)%3===0)c=mixA(c,[120,60,40],.2);if(biome==='grotto'&&m>.6)c=[24,18,16];
  if((biome==='town'||biome==='food'||biome==='bins')&&h3(x>>1,y>>1,3)<.16)c=h3(x,y,5)<.5?[206,92,76]:[236,232,226];
  if(biome==='mall'&&((x%7===0)||(y%5===0)))c=mixA(c,[60,60,80],.3);if(biome==='spire'&&h3(x>>1,y,8)<.3)c=mixA(c,[40,44,56],.5);if(biome==='vault'&&((x+y)%6===0))c=mixA(c,[255,240,180],.35);
  if(biome==='forest'&&h3(x,y,2)<.25)c=mixA(c,[16,40,24],.35);if(biome==='wild'&&h3(x,y,1)<.04)c=[226,224,120];
  if(Math.abs(lat)>1.43){const k=(Math.abs(lat)-1.43)/(Math.PI/2-1.43);c=k>.55?mixA([8,10,24],[30,40,80],h3(x,y,4)<.05?1:0):mixA([232,240,250],[120,140,170],k/.55)}
  T[y*TW+x]=pk(c[0],c[1],c[2])}}
 WTX.row=end;if(end>=TH&&!WTX.done){WTX.done=true;wtexPaths()}return WTX.done}
function wtexPaths(){const T=WTX.T;const plot=(v,rad,col)=>{const lat=Math.asin(clamp(v[1],-1,1)),lon=(Math.atan2(v[2],v[0])+Math.PI*2)%(Math.PI*2),cx=lon/(Math.PI*2)*TW,cy=(.5-lat/Math.PI)*TH,rx=rad/Math.max(.2,Math.cos(lat));
  for(let j=-rad;j<=rad;j++)for(let i=-Math.ceil(rx);i<=Math.ceil(rx);i++){if((i/rx)**2+(j/rad)**2>1)continue;const X=((Math.round(cx+i))%TW+TW)%TW,Y=clamp(Math.round(cy+j),0,TH-1);T[Y*TW+X]=col}};
 MSEG.forEach((s,i)=>{const locked=i>=LAST;for(let k=0;k<s.pts.length-1;k++)for(let q=0;q<6;q++){const p=v3.norm(v3.add(v3.mul(s.pts[k].p,1-q/6),v3.mul(s.pts[k+1].p,q/6)));plot(p,locked?.8:2.2,locked?pkh('#F0E6C8'):pkh('#8A6A3E'));if(!locked)plot(p,1.2,pkh('#E2C48A'))}});
 MREG.forEach((r,i)=>{if(i<ROUTE.length&&ROUTE[i].town){const R=seeded(i*71+3);for(let k=0;k<14;k++){const off=[(R()-.5)*.05,(R()-.5)*.05,(R()-.5)*.05],p=v3.norm(v3.add(r.v,off));plot(p,1.4,pkh(k%3?'#C8463A':'#F4F0E8'))}}})}
function buildWorldTex(){if(!WTX.done)wtexRows(TH);return WTX.T}
function wtexIdle(){if(WTX.done)return;wtexRows(24);setTimeout(wtexIdle,30)}
/* clouds floating inside the sphere */
const MCL=[];(function(){const R=seeded(812);for(let i=0;i<16;i++){const lon=(R()*200-20),lat=(R()-.5)*50,v=llv(lon,lat),alt=.86+R()*.06;MCL.push({c:v3.mul(v,alt),r:.022+R()*.028,lon,lat,alt,sp:.4+R()*.6})}})();
/* landmark billboards standing on the surface */
const MSTAMP={house:["..kkkk..",".krrrrk.","krrrrrrk","kkkkkkkk",".kmmmmk.",".kmcnmk.",".kmmnmk.",".kkkkkk."],tree:["..kkk..",".keeek.","keeEeek","keEeeek",".keeek.","..knk..","..kkk.."],bush:[".kkk.","keeek","kEeek",".kkk."],
 flag:["krr..","krrr.","k....","k....","k...."],derrick:["...k...","..kgk..","..kgk..",".kgkgk.",".kgkgk.","kgk.kgk","kkkkkkk"],mesa:["..kkkkk..",".koooook.","kooOoOook","kOoooooOk","kkkkkkkkk"],
 bin:["kkkkk","krrrk","kmmmk","kkkkk"],umb:[".kkkkk.","krwrwrk","...k...","..kkk.."],mall:["kkkkkkkkkkk","kcccccccccck","kkkkkkkkkkk","kgggggggggk","kgdgdkdgdgk","kkkkkkkkkkk"],
 crystal:[".k.","kck","kck","kck","kkk"],mush:[".kkk.","krwrk","kkkkk",".kmk.",".kkk."],tower:[".k.","kgk","kgk","kyk","kgk","kgk","kyk","kgk","kkk"],vault:["kkkkk","kyyyk","kyYyk","kyyyk","kkkkk"],cactus:[".k.","kek","kek","kkk"]};
const MSPRC={};function mstamp(k){if(MSPRC[k])return MSPRC[k];const g=MSTAMP[k],c=cnv(g[0].length,g.length),x=c.getContext('2d');g.forEach((row,j)=>{for(let i=0;i<row.length;i++){const ch=row[i];if(ch==='.')continue;x.fillStyle=ICPAL[ch]||'#000';x.fillRect(i,j,1,1)}});return MSPRC[k]=c}
const MLAND=[];(function(){const KIND={town:['house','house','tree'],grass:['tree','tree','bush'],golf:['flag','tree','bush'],thicket:['bush','bush','tree'],grotto:['derrick','derrick','house'],canyon:['mesa','cactus','mesa'],bins:['bin','bin','house'],food:['umb','umb','house'],mall:['mall'],
  feedl:['tree','bush'],silicon:['crystal','crystal'],spore:['mush','mush','mush'],trench:[],vault:['vault','vault'],spire:['tower','tower','tower']};
 MREG.forEach((r,ri)=>{const L=KIND[r.t]||[],R=seeded(ri*131+9),n=r.t==='mall'?1:L.length?7:0;for(let k=0;k<n;k++){const sp=r.r*D2R*.6,off=r.t==='mall'?[0,0,0]:[(R()-.5)*sp*2,(R()-.5)*sp*2,(R()-.5)*sp*2];MLAND.push({v:v3.norm(v3.add(r.v,off)),k:L[k%L.length]})}})})();
/* ---------- state & camera ---------- */
const MAP={on:false,cv:null,ctx:null,s:1,anim:null,g:0,face:'down',moving:false,last:0,yaw:0,pitch:0,look:.44,alt:.34,drag:null,dirty:true,img:null,proj:[],lastDraw:0};
function mapScale(){return Math.min(window.innerWidth-24,456)/MW}
function mapCam(){const P=posAtG(MAP.g),g2=Math.min(SEGSTART[SEGSTART.length-1],MAP.g+.02),Q=posAtG(g2===MAP.g?MAP.g-.02:g2);let U=v3.mul(P,-1);let F=v3.sub(Q,P);if(g2===MAP.g)F=v3.mul(F,-1);F=v3.norm(v3.sub(F,v3.mul(U,v3.dot(F,U))));
 const R0=v3.norm(v3.cross(F,U)),cy=Math.cos(MAP.yaw),sy=Math.sin(MAP.yaw),Fa=v3.norm(v3.add(v3.mul(F,cy),v3.mul(R0,sy)));
 const alt=MAP.alt,C=v3.add(v3.add(P,v3.mul(U,alt)),v3.mul(Fa,-alt*1.55)),dp=v3.norm(v3.sub(P,C)),ds=v3.norm(v3.mul(C,-1)),w=clamp(MAP.look*Math.min(1,MAP.alt/.3)+MAP.pitch,0,1);
 const fw=v3.norm(v3.add(v3.mul(dp,1-w),v3.mul(ds,w))),rt=v3.norm(v3.cross(fw,U)),up=v3.cross(rt,fw);return {C,fw,rt,up,P,foc:MW*.6}}
function mproj(cam,p){const d=v3.sub(p,cam.C),z=v3.dot(d,cam.fw);if(z<.004)return null;return {x:MW/2+cam.foc*v3.dot(d,cam.rt)/z,y:MH/2-cam.foc*v3.dot(d,cam.up)/z,z}}
function mapRender(t,lo){const c=MAP.ctx;if(!MAP.img)MAP.img=c.createImageData(MW,MH);const buf=new Uint32Array(MAP.img.data.buffer),T=buildWorldTex(),cam=mapCam(),C=cam.C,cc=v3.dot(C,C);MAP.cam=cam;
 const haze=[176,186,236],RS=.075,st=lo?2:1;
 const cl=[];MCL.forEach(k=>{const a=(k.lon+t/1000*k.sp)*D2R,la=k.lat*D2R,cv=[Math.cos(la)*Math.cos(a)*k.alt,Math.sin(la)*k.alt,Math.cos(la)*Math.sin(a)*k.alt],n=v3.norm(cv),q=mproj(cam,cv),qs=mproj(cam,n);
  const o={c:cv,r:k.r,n,b:null,sb:null};if(q){const R=k.r*cam.foc/q.z+2;o.b=[q.x-R,q.x+R,q.y-R,q.y+R]}if(qs){const R=k.r*1.1*cam.foc/qs.z+2;o.sb=[qs.x-R,qs.x+R,qs.y-R,qs.y+R]}if(qs){const R=k.r*1.3*cam.foc/qs.z+2;o.sb=[qs.x-R,qs.x+R,qs.y-R,qs.y+R]}if(o.b||o.sb)cl.push(o)});
 const sq=mproj(cam,[0,0,0]),sR=sq?(.42*cam.foc/sq.z+4):0;
 for(let j=0;j<MH;j+=st){const rowC=cl.filter(k=>k.b&&j>=k.b[2]&&j<=k.b[3]),rowS=cl.filter(k=>k.sb&&j>=k.sb[2]&&j<=k.sb[3]),nearSun=sq&&Math.abs(j-sq.y)<sR;
  for(let i=0;i<MW;i+=st){const dx=(i+.5-MW/2)/cam.foc,dy=(MH/2-j-.5)/cam.foc,d=v3.norm([cam.fw[0]+cam.rt[0]*dx+cam.up[0]*dy,cam.fw[1]+cam.rt[1]*dx+cam.up[1]*dy,cam.fw[2]+cam.rt[2]*dx+cam.up[2]*dy]);
  const b=v3.dot(C,d),ts=-b+Math.sqrt(b*b-cc+1);let col,tHit=ts;
  let sunHit=false;if(nearSun){const disc=b*b-cc+RS*RS;if(disc>0){const t0=-b-Math.sqrt(disc);if(t0>0&&t0<ts){sunHit=true;tHit=t0}}}
  let cloud=null;for(const k of rowC){if(i<k.b[0]||i>k.b[1])continue;const oc=v3.sub(C,k.c),bb=v3.dot(oc,d),q=bb*bb-(v3.dot(oc,oc)-k.r*k.r);if(q>0){const t0=-bb-Math.sqrt(q);if(t0>0&&t0<tHit){tHit=t0;cloud=k}}}
  if(sunHit&&!cloud){const p=v3.add(C,v3.mul(d,tHit)),nz=Math.max(0,-v3.dot(v3.norm(p),d));col=mixA([255,196,90],[255,252,232],Math.pow(nz,.6));if(nz>.55&&((i+j)&1)&&nz<.62)col=[255,236,170]}
  else if(cloud){const p=v3.add(C,v3.mul(d,tHit)),n=v3.norm(v3.sub(p,cloud.c)),lit=-v3.dot(n,cloud.n);col=mixA([196,186,232],[255,255,255],clamp(.55+lit*.6+(d44(i,j)-.5)*.25,0,1))}
  else{const p=v3.add(C,v3.mul(d,ts)),lat=Math.asin(clamp(p[1],-1,1)),lon=Math.atan2(p[2],p[0]);let u=Math.floor(((lon/(Math.PI*2))+1)%1*TW),v=Math.floor((.5-lat/Math.PI)*TH);if(u>=TW)u=TW-1;v=clamp(v,0,TH-1);
   const px=T[v*TW+u];col=[px&255,(px>>8)&255,(px>>16)&255];
   for(const k of rowS){if(i<k.sb[0]||i>k.sb[1])continue;const cd=v3.dot(k.c,p);if(cd>0){const perp=v3.len(v3.sub(k.c,v3.mul(p,cd)));if(perp<k.r*1.25){const e=perp/(k.r*1.25);if(e<.7||d44(i,j)<(1-e)*3.3){col=mixA(col,[36,26,76],.42)}break}}}
   const fogk=1-Math.exp(-Math.max(0,ts-.3)*.72);col=mixA(col,haze,clamp(fogk+(d44(i,j)-.5)*.06,0,.86))}
  if((!sunHit||cloud)&&sq&&b<0){const dist=Math.sqrt(Math.max(0,cc-(b*b))),g=clamp(1-dist/.42,0,1);if(g>0)col=mixA(col,[255,236,180],g*g*.85)}
  const pc=pk(col[0],col[1],col[2]);buf[j*MW+i]=pc;if(st>1){if(i+1<MW)buf[j*MW+i+1]=pc;if(j+1<MH){buf[(j+1)*MW+i]=pc;if(i+1<MW)buf[(j+1)*MW+i+1]=pc}}}}
 c.putImageData(MAP.img,0,0);
 /* markers, landmarks, player */
 const L=[];ROUTE.forEach((n,i)=>{const q=mproj(cam,MNV[i]);if(q)L.push({q,i,kind:'r'})});FUTURE.forEach((f,i)=>{if(f.t==='sun'){const q=mproj(cam,[0,0,0]);if(q)L.push({q,i,kind:'sun'});return}const q=mproj(cam,MNV[ROUTE.length+i]);if(q)L.push({q,i,kind:'f'})});
 MAP.proj=L;L.sort((a,b)=>b.q.z-a.q.z);
 L.forEach(({q,i,kind})=>{if(kind==='sun')return;const occ=sunBlocks(cam,kind==='r'?MNV[i]:MNV[ROUTE.length+i]);if(occ)return;const s=clamp(.16/q.z,.6,2.4);
  if(kind==='r'){const n=ROUTE[i],reached=i<=S.route.node,locked=n.gate&&!S.seats.includes(n.gate),col=i===S.route.node?'#F4C542':reached?'#FFFFFF':locked?'#7E8890':'#E8D8B0',x=Math.round(q.x),y=Math.round(q.y),r=Math.max(1,Math.round(1.6*s));
   c.fillStyle='rgba(20,10,40,.35)';c.fillRect(x-r-1,y,(r+1)*2+1,Math.max(1,r));c.fillStyle='#1A1430';c.fillRect(x-r-1,y-r-1-r*2,(r+1)*2+1,(r+1)*2+1);c.fillStyle=col;c.fillRect(x-r,y-r-r*2,r*2+1,r*2+1);c.fillStyle='#1A1430';c.fillRect(x,y-r*2+r,1,r*2);
   if(n.board){c.fillStyle=S.flags[n.board]?'#F4C542':'#D9434B';c.fillRect(x+r+1,y-r*4-2,Math.max(2,r+1),Math.max(2,r))}
   if(U.mapSel===i){const rr=Math.round(5*s+Math.sin(t/200)*1.5);pixRingM(c,x,y-r*2,rr,'#FFFFFF')}}
  else{const x=Math.round(q.x),y=Math.round(q.y);c.fillStyle='rgba(255,255,255,.75)';c.fillRect(x-1,y-1,3,3);c.fillStyle='#5A5080';c.fillRect(x,y,1,1);if(U.mapSel==='f'+i)pixRingM(c,x,y,Math.round(5*s+Math.sin(t/200)*1.5),'#FFFFFF')}});
 const sq2=mproj(cam,[0,0,0]);if(sq2&&U.mapSel==='f'+(FUTURE.length-1))pixRingM(c,Math.round(sq2.x),Math.round(sq2.y),Math.round(12+Math.sin(t/200)*2),'#FFFFFF');
 const LS=[];MLAND.forEach(l=>{const q=mproj(cam,l.v);if(q&&q.z<1.25&&q.x>-20&&q.x<MW+20&&q.y>-20&&q.y<MH+20&&!sunBlocks(cam,l.v))LS.push([q,l])});LS.sort((a,b)=>b[0].z-a[0].z);
 LS.forEach(([q,l])=>{const im=mstamp(l.k),sc=clamp(Math.round(.09/q.z*2)/2,.5,3),w=im.width*sc,h=im.height*sc,fog=clamp((q.z-.3)*.9,0,.7);c.globalAlpha=1-fog;c.drawImage(im,Math.round(q.x-w/2),Math.round(q.y-h),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));c.globalAlpha=1});
 const pq=mproj(cam,posAtG(MAP.g));if(pq){const fr=owFrames(S.gender||'boy'),set=fr[MAP.face]||fr.down,f=MAP.moving?set[1+Math.floor(t/140)%2]:set[0],bob=MAP.moving?0:(Math.floor(t/600)%2);
  c.fillStyle='rgba(20,10,40,.35)';c.fillRect(Math.round(pq.x)-5,Math.round(pq.y),10,2);c.drawImage(f,Math.round(pq.x)-8,Math.round(pq.y)-19+bob)}}
function sunBlocks(cam,p){const d=v3.sub(p,cam.C),L=v3.len(d),u=v3.mul(d,1/L),b=v3.dot(cam.C,u),q=b*b-(v3.dot(cam.C,cam.C)-.075*.075);if(q<=0)return false;const t0=-b-Math.sqrt(q);return t0>0&&t0<L}
function pixRingM(c,cx,cy,r,col){c.fillStyle=col;for(let a=0;a<360;a+=Math.max(4,60/r)){const rad=a*Math.PI/180;c.fillRect(Math.round(cx+Math.cos(rad)*r),Math.round(cy+Math.sin(rad)*r),1,1)}}
function mapMount(){const cv=$('#mapcv');if(!cv)return;MAP.cv=cv;MAP.ctx=cv.getContext('2d');MAP.s=mapScale();cv.style.width=MW*MAP.s+'px';cv.style.height=MH*MAP.s+'px';MAP.img=null;
 const wrap=$('#mapwrap');wrap.style.width=MW*MAP.s+'px';wrap.style.height=MH*MAP.s+'px';
 const to=gdist(S.route.node,S.route.prog),seen=S.mapSeen?gdist(S.mapSeen.node,S.mapSeen.prog):to;MAP.g=seen;if(seen!==to)mapWalk(seen,to);S.mapSeen={node:S.route.node,prog:S.route.prog};
 if(!cv._bound){cv._bound=1;cv.addEventListener('pointerdown',e=>{MAP.drag={x:e.clientX,y:e.clientY,yaw:MAP.yaw,pitch:MAP.pitch,moved:0,id:e.pointerId};cv.setPointerCapture(e.pointerId)});
  cv.addEventListener('pointermove',e=>{const D=MAP.drag;if(!D)return;const dx=e.clientX-D.x,dy=e.clientY-D.y;if(Math.abs(dx)+Math.abs(dy)>4)D.moved=1;MAP.yaw=D.yaw-dx*.008;MAP.pitch=clamp(D.pitch+dy*.003,-.44,.5)});
  cv.addEventListener('pointerup',e=>{const D=MAP.drag;MAP.drag=null;MAP.dirty=true;if(D&&!D.moved)mapPick(e)});cv.addEventListener('pointercancel',()=>{MAP.drag=null});
  cv.addEventListener('wheel',e=>{e.preventDefault();MAP.alt=clamp(MAP.alt*(e.deltaY>0?1.12:.89),.08,.6);MAP.dirty=true},{passive:false})}
 if(!MAP.on){MAP.on=true;MAP.last=performance.now();requestAnimationFrame(mapLoop)}}
function mapZoom(k){MAP.alt=clamp(MAP.alt*k,.08,.6);MAP.dirty=true}
function mapReset(){MAP.yaw=0;MAP.pitch=0;MAP.alt=.34;MAP.dirty=true}
function mapWalk(from,to){MAP.anim={from,to,t0:performance.now(),dur:RM?1:clamp(Math.abs(to-from)*9000,600,3200)}}
function onStepsAdded(){if(U.tab!=='map'||!MAP.cv||!MAP.cv.isConnected)return;const to=gdist(S.route.node,S.route.prog);if(to!==MAP.g)mapWalk(MAP.g,to);S.mapSeen={node:S.route.node,prog:S.route.prog}}
function mapLoop(ts){if(!MAP.cv||!MAP.cv.isConnected){MAP.on=false;return}requestAnimationFrame(mapLoop);
 let moving=false;if(MAP.anim){const a=MAP.anim,k=Math.min(1,(ts-a.t0)/a.dur);MAP.g=a.from+(a.to-a.from)*EASE.io(k);moving=k<1;MAP.face='up';if(k>=1)MAP.anim=null}MAP.moving=moving;
 const busy=!!(MAP.drag||moving||MAP.zt);if(ts-MAP.lastDraw<(busy?16:400)&&!MAP.dirty)return;MAP.lastDraw=ts;MAP.dirty=false;mapRender(ts,busy);mapLabels();if(busy&&!MAP.drag&&!moving)MAP.zt=0;if(MAP.wasBusy&&!busy)MAP.dirty=true;MAP.wasBusy=busy}
function mapLabels(){const L=$('#maplabels');if(!L||!MAP.cam)return;const s=MAP.s;let h='';
 (MAP.proj||[]).forEach(({q,i,kind})=>{if(q.x<-10||q.x>MW+10||q.y<0||q.y>MH)return;let name,cls='';
  if(kind==='r'){if(sunBlocks(MAP.cam,MNV[i]))return;const far=q.z>.75&&i!==S.route.node&&U.mapSel!==i;if(far)return;name=ROUTE[i].name;cls=(i===S.route.node?' here':'')+(U.mapSel===i?' sel':'')}
  else if(kind==='f'){if(sunBlocks(MAP.cam,MNV[ROUTE.length+i]))return;if(q.z>.9&&U.mapSel!=='f'+i)return;name=FUTURE[i].name;cls=' fog'+(U.mapSel==='f'+i?' sel':'')}
  else{name=FUTURE[i].name;cls=' sun'+(U.mapSel==='f'+i?' sel':'')}
  const n=kind==='r'?i:'f'+i,estW=name.length*7.2+14,right=q.x*s+8+estW<MW*s||q.x<MW*.35;h+=`<button class="mlab${cls}" data-a="msel" data-n="${n}" style="top:${((q.y-(kind==='r'?6:0))*s).toFixed(1)}px;${right?`left:${((q.x+5)*s).toFixed(1)}px`:`right:${((MW-q.x+5)*s).toFixed(1)}px`}">${esc(name)}</button>`});
 if(L._h!==h){L.innerHTML=h;L._h=h}}
function mapPick(ev){const cv=MAP.cv;if(!cv)return;const r=cv.getBoundingClientRect(),x=(ev.clientX-r.left)/MAP.s,y=(ev.clientY-r.top)/MAP.s;let best=null,bd=14;
 (MAP.proj||[]).forEach(({q,i,kind})=>{const d=Math.hypot(q.x-x,q.y-(kind==='r'?3:0)-y);if(d<bd){bd=d;best=kind==='r'?i:'f'+i}});
 if(best!==null){U.mapSel=best;paintMapCard();mapLabels()}}
