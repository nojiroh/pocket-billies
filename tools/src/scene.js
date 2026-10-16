/* ================= BATTLE STAGE v4: perspective ground on the inside of a sphere, billboards, 3D particles, depth of field ================= */
const SW=224,SH=168,OX=16,OY=12,LW=SW+2*OX,LH=SH+2*OY,H0=OY+51,FOC=170,RCURV=300,ZMAX=330;
const POS=[{x:-.88,z:2.6},{x:1.72,z:5.7}],KB=[1.4,1],UPP=POS.map(p=>p.z/FOC);
const HOMECAM={x:0,y:1.6,z:0,yaw:0,hz:0};
const FOCAM=[{x:-.5,y:1.78,z:-.55,yaw:-.11,hz:-8},{x:.8,y:1.4,z:1.1,yaw:.09,hz:8}];
const B44=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const d44=(x,y)=>B44[(x&3)+((y&3)<<2)]/16;
function seeded(n){let s=n>>>0||1;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
function pxCtx(c){const x=c.getContext('2d'),id=x.createImageData(c.width,c.height),D=id.data,W=c.width,H=c.height;
 return {x,set(px,py,col,a=255){px|=0;py|=0;if(px<0||py<0||px>=W||py>=H)return;const [r,g,b]=typeof col==='string'?rgb(col):col,i=(py*W+px)*4;if(a>=255){D[i]=r;D[i+1]=g;D[i+2]=b;D[i+3]=255}else{const k=a/255;D[i]=D[i]*(1-k)+r*k;D[i+1]=D[i+1]*(1-k)+g*k;D[i+2]=D[i+2]*(1-k)+b*k;D[i+3]=Math.max(D[i+3],a)}},
  get(px,py){const i=(py*W+px)*4;return D[i+3]?[D[i],D[i+1],D[i+2]]:null},done(){x.putImageData(id,0,0)}}}
function gradCol(arr,t,x,y){const n=arr.length-1,v=clamp(t,0,1)*n,i=Math.min(n-1,Math.floor(v)),f=v-i;return f>d44(x,y)?arr[i+1]:arr[i]}
function blob(P,cx,cy,rx,ry,cols,r){for(let y=Math.floor(cy-ry-1);y<=cy+ry+1;y++)for(let x=Math.floor(cx-rx-1);x<=cx+rx+1;x++){const dx=(x+.5-cx)/rx,dy=(y+.5-cy)/ry,d=dx*dx+dy*dy;if(d>1)continue;const I=-dx*.5-dy*.7+(r?r()*.1:0);P.set(x,y,d>.82?cols[0]:I>.35?cols[3]:I>-.1?cols[2]:cols[1])}}
/* value noise */
function vnoise(seed){const r=seeded(seed),N=256,T=new Float32Array(N*N);for(let i=0;i<N*N;i++)T[i]=r();
 const g=(x,y)=>T[((y&255)<<8)|(x&255)];return (x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return (g(xi,yi)*(1-u)+g(xi+1,yi)*u)*(1-v)+(g(xi,yi+1)*(1-u)+g(xi+1,yi+1)*u)*v}}
const pk=(r,g,b)=>(255<<24)|((b&255)<<16)|((g&255)<<8)|(r&255);
const pkh=h=>{const c=hexA(h);return pk(c[0],c[1],c[2])};
/* ---------- areas ---------- */
const AREAS={
 grass:{sky:['#5E7AD8','#9AB8F0','#E8E2F2'],fog:'#D8DCEE',fogD:80,base:['#7CC85A','#6AB44E','#5AA044','#94D86E'],path:'#D8C08A',pad:['#C8A870','#8EC86A'],props:['tree','tree','bush','bush','flowers','lamp','busstop','fence'],amb:'pollen',far:'fields'},
 golf:{sky:['#5E7AD8','#A0C0F2','#ECE6F4'],fog:'#DCE2EE',fogD:85,base:['#8ED86A','#7CC85A','#6CB44E','#A6E482'],stripes:1,pad:['#E8D8A0','#A6E482'],props:['tree','flag','bush','tree','bunker','cart'],amb:'pollen',far:'fields'},
 shell:{sky:['#3A3E7A','#6A70A8','#B8B0C8'],fog:'#9A98B4',fogD:55,base:['#4E8A48','#427A3E','#386C36','#5E9E56'],path:'#8A7A5A',pad:['#7A6A4A','#5E9E56'],props:['bush','bush','mailbox','mailbox','tree','bush','sign'],amb:'spore',far:'woods'},
 grotto:{sky:['#2A1E28','#5A3A3A','#9A6A50'],fog:'#7A5A48',fogD:45,base:['#5A4C42','#4E4138','#433830','#6A5A4E'],oily:1,pad:['#3A302A','#6A5A4E'],props:['derrick','rock','barrel','rock','derrick','pipe'],amb:'drip',far:'badlands'},
 esc:{sky:['#C86A5A','#F0A070','#F8DCB0'],fog:'#F2D2A8',fogD:70,base:['#D8AE7E','#C89E6E','#B88E60','#E4C090'],stripes:2,pad:['#B88E60','#E4C090'],props:['mesa','escal','cactus','rock','cactus'],amb:'sand',far:'desert'},
 clear:{indoor:1,sky:['#1E1A28','#2E2A3C','#4A4458'],fog:'#5A5468',fogD:60,base:['#ECE4D0','#D8CEB6'],tile:1,pad:['#C83C3C','#F4EEDC'],wall:'clear',props:['bin','bin','cartS','salesign','bin'],amb:'dust'},
 food:{indoor:1,sky:['#1E1A2E','#2E2A44','#4A4062'],fog:'#5A4E6E',fogD:60,base:['#F2DCC2','#E2C6A6'],tile:1,pad:['#D9434B','#F8E6CE'],wall:'food',props:['table','table','pretzel','table','trash'],amb:'dust'},
 mall:{indoor:1,sky:['#14122A','#22204A','#3A3670'],fog:'#3A3670',fogD:70,base:['#ECE8F4','#D2CCDE'],tile:2,pad:['#8FD8FF','#F2EEF8'],wall:'mall',props:['planter','bench','fountain','planter','kioskP'],amb:'dust'},
};
const CX0=.55,CZ0=3.9;
/* ---------- props (billboards baked with the creature engine, 30 px per world unit) ---------- */
const PROPB={
 tree:r=>{const h=3.2+r()*1.4,w=1.1+r()*.4;return {h,mk:()=>({bb:[-w*36,-h*32,w*36,4],th:16,g:[[sC(0,0,0,-h*14,4,3)],[sUnion(sE(0,-h*20,w*22,w*20),sE(-w*12,-h*15,w*16,w*14),sE(w*13,-h*16,w*15,w*14),sE(0,-h*26,w*16,w*14)),'u']],
  mat:Mat('#6A4A2E',{hi:.4}),p:[{f:sUnion(sE(0,-h*20,w*22,w*20),sE(-w*12,-h*15,w*16,w*14),sE(w*13,-h*16,w*15,w*14),sE(0,-h*26,w*16,w*14)),m:Mat('#4E9A4A',{c2:'#2E6A3A',grad:[0,-h*32,0,-h*10],hi:.6,pat:(x,y,q,i,j,c)=>hsh(i>>1,j>>1,4)<.18?mixA(c,INK,.25):hsh(i>>1,j>>1,8)<.1?mixA(c,[255,255,200],.2):null})}],ao:.1})}},
 bush:r=>({h:1,mk:()=>({bb:[-34,-30,34,3],th:12,g:[[sUnion(sE(0,-12,24,13),sE(-14,-8,14,9),sE(14,-9,14,10))]],mat:Mat('#5AA04A',{c2:'#2E6A34',grad:[0,-26,0,0],hi:.6,pat:(x,y,q,i,j,c)=>hsh(i>>1,j>>1,2)<.2?mixA(c,INK,.22):null}),ao:.1,deco:A=>{if(r()<.5)for(let n=0;n<5;n++)A.ell(-14+n*7,-14+((n*7)%9),1.6,1.6,['#F27AA8','#FFFFFF','#F4C542'][n%3])}})}),
 flowers:r=>({h:.4,mk:()=>({bb:[-24,-14,24,2],th:3,g:[[sE(0,-3,20,4)]],mat:Mat('#5AA04A'),ao:0,deco:A=>{for(let n=0;n<14;n++){const x=-18+n*2.7,y=-4-((n*5)%6);A.ell(x,y,1.3,1.3,['#F27AA8','#FFFFFF','#F4C542','#AE8AEC'][n%4]);A.px(x,y,'#F4C542')}}})}),
 lamp:r=>({h:3.6,mk:()=>({bb:[-12,-112,12,3],th:2,g:[[sC(0,0,0,-100,2.4,1.8)],[sE(0,-104,8,6)],[sB(0,-1,5,2,1)]],mat:Mat('#3A4058',{gloss:.6}),p:[{f:sE(0,-104,6,4.5),m:Mat('#FFF4C0',{flat:1})}]})}),
 busstop:r=>({h:3,mk:()=>({bb:[-22,-96,22,3],th:2,g:[[sC(0,0,0,-80,1.8)],[sB(0,-84,16,10,2)]],mat:Mat('#8A939C',{gloss:.6}),p:[{f:sB(0,-84,14,8,1.5),m:Mat('#2E6AD8',{flat:1})}],deco:A=>{A.rect(-10,-89,20,2,'#FFFFFF');A.rect(-10,-84,12,2,'#FFFFFF');A.rect(-10,-80,16,1.5,'#9AD8F0')}})}),
 fence:r=>({h:1,mk:()=>({bb:[-40,-30,40,3],th:2,g:[[sB(0,-14,36,2)],[sB(0,-22,36,2)],...[-30,-15,0,15,30].map(x=>[sB(x,-14,2.5,14,1)])],mat:Mat('#F4F0E8',{hi:.5})})}),
 flag:r=>({h:2.6,mk:()=>({bb:[-6,-84,24,6],th:2,g:[[sC(0,0,0,-78,1.2)],[sP([[0,-78],[18,-72],[0,-66]],.5)],[sE(0,0,7,2.2)]],mat:Mat('#F4F4F6'),p:[{f:sP([[0,-78],[18,-72],[0,-66]],.5),m:Mat('#E84848')},{f:sE(0,0,7,2.2),m:Mat('#1A2A1A')}]})}),
 bunker:r=>({h:.2,flat:1,mk:()=>({bb:[-40,-10,40,4],th:2,g:[[sE(0,-2,36,6)]],mat:Mat('#F2E2A8',{flat:1})})}),
 cart:r=>({h:1.4,mk:()=>({bb:[-34,-50,34,4],th:6,g:[[sB(0,-18,26,12,4)],[sB(0,-44,28,3,1)],[sC(-22,-40,-22,-24,1.4)],[sC(22,-40,22,-24,1.4)]],mat:Mat('#F4F4F6',{gloss:.5}),p:[{f:sB(0,-44,28,3,1),m:Mat('#2F855A')}],deco:A=>{A.ell(-16,-3,5,5,'#1E1A22');A.ell(16,-3,5,5,'#1E1A22')}})}),
 mailbox:r=>({h:1.6,mk:()=>({bb:[-26,-60,26,3],th:3,g:[[sC(0,0,0,-36,2)],[sB(0,-46,20,10,3)]],mat:Mat('#7E8890',{gloss:.5}),p:[{f:sB(0,-46,20,10,3),m:Mat('#3E5A9A',{gloss:.5})}],deco:A=>{for(let i=0;i<4;i++)for(let j=0;j<2;j++){A.rect(-17+i*9,-54+j*9,7,6,'#2A3A6A');A.px(-12+i*9,-51+j*9,'#F4C542')}}})}),
 sign:r=>({h:2,mk:()=>({bb:[-24,-70,24,3],th:2,g:[[sC(0,0,0,-50,1.8)],[sB(0,-56,20,9,1.5)]],mat:Mat('#8A6A4A'),p:[{f:sB(0,-56,18,7.5,1),m:Mat('#F4F0E0',{flat:1})}],deco:A=>{A.rect(-14,-60,28,1.5,'#3A3F45');A.rect(-14,-56,20,1.5,'#3A3F45');A.rect(-14,-52,24,1.5,'#8A939C')}})}),
 derrick:r=>({h:4,mk:()=>Object.assign(PROPS.derrick({}),{bb:[-8,-22,8,2]}),k:4.2}),
 rock:r=>({h:1,mk:()=>({bb:[-34,-34,34,3],th:14,g:[[sUnion(sE(0,-12,26,14),sE(10,-20,14,12),sE(-12,-6,14,8))]],mat:Mat('#6A5A52',{hi:.5,pat:(x,y,q,i,j,c)=>hsh(i>>2,j>>2,5)<.25?mixA(c,INK,.15):null}),ao:.15})}),
 barrel:r=>({h:1.2,mk:()=>({bb:[-16,-40,16,3],th:8,g:[[sB(0,-17,12,17,3)]],mat:Mat('#3E6FB0',{gloss:.6}),p:[{f:(x,y)=>Math.abs(y+9)-1.5,m:Mat('#1E2A4A')},{f:(x,y)=>Math.abs(y+25)-1.5,m:Mat('#1E2A4A')}],deco:A=>A.ell(0,-34,10,2,'#1A1410')})}),
 pipe:r=>({h:1,mk:()=>({bb:[-60,-30,60,3],th:8,g:[[sB(0,-12,56,8,8)],[sB(-40,-12,4,10,1)],[sB(40,-12,4,10,1)]],mat:Mat('#8A939C',{gloss:.7})})}),
 mesa:r=>({h:6,mk:()=>({bb:[-80,-190,80,4],th:30,g:[[sP([[-70,0],[-50,-170],[45,-176],[70,0]],4)]],mat:Mat('#C8784A',{hi:.5,pat:(x,y,q,i,j,c)=>((Math.floor(y/9))%3===0)?mixA(c,[120,50,40],.25):null}),ao:.1})}),
 escal:r=>({h:3.5,mk:()=>({bb:[-60,-120,60,3],th:6,g:[[sP([[-55,0],[-40,0],[50,-100],[50,-112],[30,-112]],2)]],mat:Mat('#C3C9D0',{gloss:.7,pat:(x,y,q,i,j,c)=>(j%3===0)?mixA(c,INK,.3):null})})}),
 cactus:r=>({h:2,mk:()=>({bb:[-24,-70,24,3],th:6,g:[[sC(0,0,0,-60,6,5)],[sCurve([0,-30],[-16,-30],[-16,-48],4,3.5)],[sCurve([0,-40],[14,-40],[14,-56],4,3.5)]],mat:Mat('#4E9A5A',{hi:.6,pat:(x,y,q,i,j,c)=>i%3===0?mixA(c,INK,.2):null})})}),
 bin:r=>({h:1.4,mk:()=>({bb:[-34,-44,34,3],th:10,g:[[sB(0,-18,30,18,3)]],mat:Mat('#C83C3C',{gloss:.4}),p:[{f:sB(0,-34,30,3),m:Mat('#8E2A2A')}],deco:A=>{for(let n=0;n<8;n++)A.ell(-24+n*7,-38-(n%3)*2,3,2.6,['#4F80E8','#F4C542','#5DBB7E','#E2547A'][n%4]);A.rect(-14,-22,28,8,'#FFF1B8');A.rect(-10,-19,20,2,'#C83C3C')}})}),
 cartS:r=>PROPB.cart(r),
 salesign:r=>({h:2,mk:()=>({bb:[-26,-70,26,3],th:2,g:[[sC(0,0,0,-46,1.6)],[sB(0,-54,22,14,2)]],mat:Mat('#FFF1B8',{flat:1}),deco:A=>{A.rect(-18,-62,36,6,'#D9434B');A.rect(-14,-52,28,3,'#2A2238');A.rect(-14,-47,18,3,'#2A2238')}})}),
 table:r=>({h:3,mk:()=>({bb:[-40,-100,40,3],th:6,g:[[sC(0,0,0,-80,1.6)],[sAnd(sE(0,-78,36,16),(x,y)=>y+78)],[sB(0,-30,22,2.5,1)],[sC(-14,-30,-18,0,1.4)],[sC(14,-30,18,0,1.4)]],mat:Mat('#F4F4F6'),p:[{f:sAnd(sE(0,-78,36,16),(x,y)=>y+78),m:Mat('#D9434B',{pat:(x,y,q,i,j,c)=>((Math.floor((x+40)/8))&1)?mixA(c,[255,255,255],.85):null})}]})}),
 pretzel:r=>({h:2.4,mk:()=>({bb:[-40,-84,40,3],th:6,g:[[sB(0,-22,34,22,3)],[sB(0,-60,38,8,2)],[sC(-30,-44,-30,-56,1.4)],[sC(30,-44,30,-56,1.4)]],mat:Mat('#F2C14E',{hi:.5}),p:[{f:sB(0,-60,38,8,2),m:Mat('#D9434B')}],deco:A=>{A.rect(-26,-64,52,4,'#FFFFFF');A.ell(0,-30,8,6,'#B86E2A');A.ell(0,-30,3,2.2,'#F2C14E')}})}),
 trash:r=>({h:1.2,mk:()=>({bb:[-14,-40,14,3],th:6,g:[[sB(0,-17,10,17,3)]],mat:Mat('#5A6E62',{gloss:.4})})}),
 planter:r=>({h:2,mk:()=>({bb:[-34,-80,34,3],th:8,g:[[sB(0,-12,26,12,2)],[sUnion(sE(0,-40,24,22),sE(-14,-30,14,12),sE(14,-32,14,12))]],mat:Mat('#C8CED3',{gloss:.4}),p:[{f:sUnion(sE(0,-40,24,22),sE(-14,-30,14,12),sE(14,-32,14,12)),m:Mat('#3E8A4E',{c2:'#1E5A34',grad:[0,-62,0,-20],hi:.6,pat:(x,y,q,i,j,c)=>hsh(i>>1,j>>1,2)<.2?mixA(c,INK,.25):null})}]})}),
 bench:r=>({h:1,mk:()=>({bb:[-44,-34,44,3],th:4,g:[[sB(0,-14,40,3,1)],[sB(0,-26,40,3,1)],[sB(-34,-8,2.5,8)],[sB(34,-8,2.5,8)]],mat:Mat('#8A5A3A',{hi:.5})})}),
 fountain:r=>({h:2.4,mk:()=>({bb:[-54,-90,54,3],th:8,g:[[sB(0,-10,48,10,6)],[sC(0,-10,0,-50,5,3)],[sE(0,-52,14,4)]],mat:Mat('#E8E4F0',{gloss:.5}),p:[{f:sB(0,-14,44,5,4),m:Mat('#7AC8F0',{flat:1,gloss:.8})}],deco:A=>{for(let n=0;n<14;n++){const a=n/13*Math.PI;A.px(Math.cos(a)*16,-56-Math.sin(a)*22,'#BFE8FF')}}})}),
 kioskP:r=>({h:2,mk:()=>SHELLS.kiosk({w:14,h:14},{}),k:2.2}),
};
function cloudSprite(seed,w,h,cols){const c=cnv(w,h),P=pxCtx(c),r=seeded(seed);const n=5+Math.floor(r()*4),bs=[];for(let i=0;i<n;i++)bs.push([w*.15+r()*w*.7,h*.45+r()*h*.3,h*.25+r()*h*.25]);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let best=9;bs.forEach(([bx,by,br])=>{const d=Math.hypot(x+.5-bx,y+.5-by)/br;if(d<best)best=d});if(best>1)continue;const top=y<h*.55;P.set(x,y,best>.86?cols[1]:top?(d44(x,y)<.7?cols[3]:cols[2]):cols[2])}
 P.done();return c}
/* ---------- cloud billboards ---------- */
function cloudPart(seed){const r=seeded(seed),bs=[];for(let i=0;i<6;i++)bs.push(sE(-30+i*12+r()*6,-10-r()*12-(i>1&&i<4?10:0),12+r()*8,10+r()*6));
 return {bb:[-50,-46,50,6],th:12,g:[[sUnion(...bs)]],mat:Mat('#FFFFFF',{c2:'#C8C4E8',grad:[0,-40,0,4],hi:.7}),rim:.4,ol:false}}
/* ---------- textures ---------- */
const TEXN=512,TEXS=16;
function buildNearTex(key){const A=AREAS[key],T=new Uint32Array(TEXN*TEXN),r=seeded(key.length*913+7),n1=vnoise(11+key.length),n2=vnoise(29);
 const base=A.base.map(hexA);
 for(let v=0;v<TEXN;v++)for(let u=0;u<TEXN;u++){const X=(u-256)/TEXS+CX0,Z=(v-256)/TEXS+CZ0;let c;
  if(A.tile){const tu=Math.floor(X*(A.tile===2?1:1.5)),tv=Math.floor(Z*(A.tile===2?1:1.5));c=((tu+tv)&1)?base[0]:base[1];const fu=X*1.5-Math.floor(X*1.5),fv=Z*1.5-Math.floor(Z*1.5);if(fu<.04||fv<.04)c=mixA(c,INK,.12);
   if(A.tile===2){const m=n1(X*1.3,Z*1.3);c=mixA(c,[255,255,255],m>.6?.25:0);if(Math.abs(Math.sin(X*.8+Z*.3))<.05)c=mixA(c,[200,190,230],.4)}}
  else{const m=n1(X*.9,Z*.9)*.6+n2(X*3.1,Z*3.1)*.4;c=m>.62?base[3]:m>.48?base[0]:m>.36?base[1]:base[2];
   if(A.stripes===1&&((Math.floor(X*.8)+0)&1))c=mixA(c,[255,255,255],.07);if(A.stripes===2&&Math.floor(Z*1.2)%3===1)c=mixA(c,INK,.06);
   const q=hsh(u,v,1);if(q<.06)c=mixA(c,INK,.18);else if(q>.965)c=mixA(c,[255,255,220],.2);
   if(A.path){const px=-2.6+Math.sin(Z*.32)*1.2;if(Math.abs(X-px)<.55+n2(X*4,Z*4)*.2)c=mixA(hexA(A.path),INK,hsh(u>>1,v>>1,3)<.15?.15:0)}
   if(A.oily){const o=n2(X*1.6+30,Z*1.6);if(o>.72)c=o>.8&&q<.3?[70,70,102]:[14,10,8]}}
  T[v*TEXN+u]=pk(c[0],c[1],c[2])}
 const paint=(cx,cz,rad,fn)=>{for(let v=Math.floor((cz-CZ0-rad)*TEXS+256);v<=(cz-CZ0+rad)*TEXS+256;v++)for(let u=Math.floor((cx-CX0-rad)*TEXS+256);u<=(cx-CX0+rad)*TEXS+256;u++){const X=(u-256)/TEXS+CX0,Z=(v-256)/TEXS+CZ0,d=Math.hypot(X-cx,Z-cz)/rad;if(d>1)continue;const i=((v&511)*TEXN)+(u&511),o=T[i],oc=[o&255,(o>>8)&255,(o>>16)&255],c=fn(d,oc,u,v);if(c)T[i]=pk(c[0],c[1],c[2])}};
 const pad=A.pad.map(hexA);
 POS.forEach((p,i)=>{const R=i?1.3:1.5;paint(p.x,p.z,R,(d,oc,u,v)=>d>.9?mixA(pad[1],[255,255,255],.25):d>.84?mixA(pad[0],INK,.3):mixA(pad[0],d<.5&&d44(u,v)<.3?[255,255,255]:INK,d<.5?.08:(d-.5)*.25))});
 return T}
function buildFarTex(kind){const N=256,T=new Uint32Array(N*N),n1=vnoise(77),n2=vnoise(91),n3=vnoise(13);
 const P={fields:[[124,190,90],[160,200,96],[206,198,120],[96,160,80],[70,130,74]],woods:[[60,110,64],[48,92,56],[86,130,74],[40,80,50],[70,120,70]],badlands:[[120,96,80],[96,78,66],[140,110,86],[80,64,56],[110,90,70]],desert:[[230,190,140],[216,170,120],[240,206,160],[200,150,110],[226,180,130]]}[kind]||[[124,190,90]];
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const m=n1(x/9,y/9),f=n2(x/4,y/4),w=n3(x/14,y/14);let c=P[Math.floor((m*.7+f*.3)*P.length*1.4)%P.length];
  if(((Math.floor(x/7)+Math.floor(y/7))&1)&&kind==='fields')c=mixA(c,[255,240,180],.12);
  if(w>.74&&kind!=='desert'&&kind!=='badlands')c=[90,150,210];if(w>.7&&w<=.74&&kind!=='desert')c=[220,214,170];
  if(hsh(x>>2,y>>2,9)<.03&&kind!=='desert'){c=hsh(x,y,3)<.5?[214,96,80]:[220,220,230]}
  if(Math.abs(Math.sin(x*.05)*30+128-y)<.8)c=[200,190,170];T[y*N+x]=pk(c[0],c[1],c[2])}
 return T}
function buildWallTex(key){const W=1024,H=64,c=cnv(W,H),P=pxCtx(c),A=AREAS[key],r=seeded(key.length*41);
 const cols=key==='mall'?['#E9739A','#8FD8FF','#F4C542','#5DBB7E','#AE8AEC']:key==='food'?['#F2C14E','#D9434B','#5DBB7E','#F59A2A','#E2547A']:['#C83C3C','#F4C542','#8E2A2A','#FFFFFF'];
 for(let x=0;x<W;x++)for(let y=0;y<H;y++)P.set(x,y,y<8?'#2A2640':y<10?'#4A4462':'#3A3450');
 for(let s=0;s<W;s+=64){const col=cols[Math.floor(r()*cols.length)];for(let x=s+3;x<s+61;x++){for(let y=12;y<20;y++)P.set(x,y,col);for(let y=22;y<60;y++){const g=(y-22)/38;P.set(x,y,x<s+6||x>s+57?'#2A2640':mixHex(mixHex('#2E3A5A','#8AB8E8',g),col,.12))}}
  for(let x=s+10;x<s+54;x+=2)P.set(x,15,'#FFFFFF');for(let y=36;y<60;y++)for(let x=s+26;x<s+38;x++)P.set(x,y,'#1E1A2A');
  for(let k=0;k<4;k++){const ix=s+10+k*12,iy=44+Math.floor(r()*6);for(let y=iy;y<60;y++)for(let x=ix;x<ix+6;x++)if(x<s+26||x>=s+38)P.set(x,y,cols[(k+1)%cols.length])}
  for(let y=22;y<60;y++)P.set(s+12+((y*3)%40),y,'#FFFFFF',60)}
 P.done();const d=c.getContext('2d').getImageData(0,0,W,H).data,T=new Uint32Array(W*H);for(let i=0;i<W*H;i++)T[i]=pk(d[i*4],d[i*4+1],d[i*4+2]);return T}
/* ---------- foreground ---------- */
function grassBlade(P,bx,by,h,lean,cols){for(let i=0;i<h;i++){const t=i/h,w=Math.max(1,Math.round((1-t)*3)),xc=bx+lean*t*t*h*.4;for(let j=0;j<w;j++)P.set(Math.round(xc)+j-1,by-i,j===0?cols[0]:j===w-1&&w>1?cols[2]:cols[1])}}
function buildFg(key){const A=AREAS[key],c=cnv(LW,LH),P=pxCtx(c),r=seeded(key.length*53+11);
 if(!A.indoor&&key!=='grotto'&&key!=='esc'){const g=A.base,cols=[shadeHex(g[2],.5),shadeHex(g[1],.8),g[3]];
  for(let k=0;k<28;k++)grassBlade(P,2+Math.floor(r()*50),LH,26+Math.floor(r()*30),(r()-.4)*1.6,cols);
  for(let k=0;k<22;k++)grassBlade(P,LW-52+Math.floor(r()*50),LH,20+Math.floor(r()*26),(r()-.6)*1.6,cols)}
 else if(key==='grotto'||key==='esc'){const C=key==='grotto'?['#0E0B0A','#2A221E','#3E332C','#5A4A40']:['#6A3A2A','#9A5A3A','#B8784A','#D8986A'];blob(P,LW-16,LH-4,34,26,C,r);blob(P,12,LH+4,18,44,C,r)}
 else{for(let y=LH-22;y<LH;y++)for(let x=0;x<44;x++)P.set(x,y,y<LH-20?'#C8CED3':x<22?'#5A5466':'#463F52');
  for(let k=0;k<8;k++){const ang=-2.5+k*.36,len=24+r()*12;for(let i=0;i<len;i++){const x=22+Math.cos(ang)*i,y=LH-22+Math.sin(ang)*i-Math.sin(i/len*Math.PI)*4;P.set(x,y,'#2E7A4A');P.set(x,y+1,'#4FAE5E')}}}
 P.done();return c}
/* ---------- scene state ---------- */
const EASE={lin:t=>t,out:t=>1-(1-t)*(1-t),in:t=>t*t,io:t=>t<.5?2*t*t:1-2*(1-t)*(1-t),out3:t=>1-Math.pow(1-t,3),back:t=>{const c=1.7;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)}};
const mkSide=()=>({sp:null,gold:false,show:false,ox:0,oy:0,sc:1,a:1,white:0,dark:0,blinkUntil:0,seed:rnd()*6,act:null});
const SC={on:false,t:0,last:0,hold:0,area:'grass',u:2,cv:{},cx:{},img:{},near:null,far:null,wall:null,fg:null,props:[],clouds:[],buf:[null,null],
 cam:Object.assign({},HOMECAM),css:{r:0,z:0},shk:0,focusK:null,tws:[],evs:[],parts:[],oil:false,ring:null,coin:null,s:[mkSide(),mkSide()],tr:[{who:null,show:false,x:0,a:1},{who:null,show:false,x:0,a:1}]};
function scStart(area){SC.area=AREAS[area]?area:'grass';const A=AREAS[SC.area],k=SC.area;
 ['Sky','Mid','Near','Fg','Fx'].forEach(n=>{const c=$('#cv'+n);c.width=LW;c.height=LH;SC.cv[n]=c;const x=c.getContext('2d');x.imageSmoothingEnabled=false;SC.cx[n]=x;SC.img[n]=x.createImageData(LW,LH)});
 SC.near=PX['nt'+k]||(PX['nt'+k]=buildNearTex(k));SC.far=A.indoor?null:(PX['ft'+A.far]||(PX['ft'+A.far]=buildFarTex(A.far)));SC.wall=A.wall?(PX['wt'+k]||(PX['wt'+k]=buildWallTex(k))):null;
 SC.fg=PX['fg'+k]||(PX['fg'+k]=buildFg(k));SC.skyC=A.sky.map(hexA);SC.fogC=hexA(A.fog);
 if(!PX['pr'+k]){const r=seeded(k.length*97+3),L=[];for(let n=0;n<34;n++){const a=r()*Math.PI*2,d=4.2+r()*(A.indoor?7:13),x=CX0+Math.cos(a)*d*1.3,z=CZ0+2+Math.sin(a)*d;if(z<1.2||Math.abs(x-(-2.6+Math.sin(z*.32)*1.2))<1&&!A.indoor||POS.some(q=>Math.hypot(x-q.x,z-q.z)<2.4)||(x>-1.8&&x<3.4&&z<7.8))continue;
   const kind=A.props[n%A.props.length],P=PROPB[kind](r);L.push({kind,x,z,img:null,P})}PX['pr'+k]=L}
 SC.props=PX['pr'+k];SC.props.forEach(p=>{if(!p.img){const key='pi'+p.kind;p.img=PX[key]||(PX[key]=bake(p.P.mk(),p.P.k||1));p.h=p.P.h;p.k=p.P.k||1}});
 SC.clouds=A.indoor?[]:[0,1,2,3,4,5].map(i=>({img:PX['cl'+i]||(PX['cl'+i]=bake(cloudPart(i*31+7),1)),x:-14+i*6+rnd()*4,y:7+rnd()*5,z:10+i*7+rnd()*5,v:.12+rnd()*.12}));
 SC.cx.Fg.clearRect(0,0,LW,LH);SC.cx.Fg.drawImage(SC.fg,0,0);
 SC.buf=[cnv(10,10),cnv(10,10)];SC.s=[mkSide(),mkSide()];SC.tr=[{who:null,show:false,x:0,a:1},{who:null,show:false,x:0,a:1}];SC.tws=[];SC.evs=[];SC.parts=[];SC.cam=Object.assign({},HOMECAM);SC.css={r:0,z:0};SC.oil=false;SC.ring=null;SC.coin=null;SC.shk=0;SC.hold=0;SC.focusK=null;scFocus('wide');
 if(!SC.on){SC.on=true;SC.last=performance.now();requestAnimationFrame(scLoop)}}
function scStop(){SC.on=false}
function tw(o,p,to,dur,ease='out',delay=0){SC.tws.push({o,p,to,dur:Math.max(1,dur),ease:EASE[ease]||EASE.out,st:SC.t+delay,from:null})}
function at(ms,fn){SC.evs.push({t:SC.t+ms,fn})}
function scFlush(){SC.tws.sort((a,b)=>a.st-b.st).forEach(w=>{w.o[w.p]=w.to});SC.tws=[];const ev=SC.evs.sort((a,b)=>a.t-b.t);SC.evs=[];ev.forEach(e=>e.fn())}
function act(i,k,dur=1000){SC.s[i].act={k,t0:SC.t,dur}}
function scFocus(f){if(SC.focusK===f)return;SC.focusK=f;const Bl={wide:[.9,0,.7,2.4],foe:[1.6,0,2.6,3.6],me:[2.2,1.4,0,2.4],none:[0,0,0,0]}[f]||[0,0,0,0];
 ['Sky','Mid','Near','Fg'].forEach((n,i)=>{const c=SC.cv[n];if(c)c.style.filter=Bl[i]&&!RM?`blur(${(Bl[i]*SC.u/2).toFixed(2)}px)`:'none'})}
function scFlash(col,a,dur){const f=$('#flash');if(!f)return;f.style.transition='none';f.style.background=col;f.style.opacity=a;void f.offsetWidth;f.style.transition=`opacity ${dur}ms ease-out`;f.style.opacity=0}
function scCA(ms=160){const w=$('#camWorld');if(!w||RM)return;w.classList.add('ca');setTimeout(()=>w.classList.remove('ca'),ms)}
function hitStop(ms){if(!RM)SC.hold=performance.now()+ms}
/* ---------- projection ---------- */
function proj(X,Y,Z){const C=SC.cam,cs=Math.cos(C.yaw),sn=Math.sin(C.yaw),dx=X-C.x,dz=Z-C.z,lx=dx*cs-dz*sn,lz=dx*sn+dz*cs;if(lz<.25)return null;
 return {x:LW/2+FOC*lx/lz,y:H0+C.hz-FOC*(Y-C.y+lz*lz/(2*RCURV))/lz,z:lz,s:FOC/lz}}
function sideWorld(i){const s=SC.s[i],p=POS[i],V=[POS[1].x-POS[0].x,POS[1].z-POS[0].z],L=Math.hypot(V[0],V[1]),u=UPP[i];return {x:p.x+s.ox*u*V[0]/L,z:p.z+s.ox*u*V[1]/L,y:-s.oy*u}}
function sideCenter(i){const w=sideWorld(i),s=SC.s[i];let h=1.4;if(s.sp){const R=rigParts(s.sp,s.gold,KB[i]);h=(R.geo.base-R.geo.mid)*UPP[i]*s.sc}return {x:w.x,y:w.y+h,z:w.z}}
/* ---------- render ---------- */
function scLoop(ts){if(!SC.on)return;requestAnimationFrame(scLoop);let dt=clamp(ts-SC.last,0,50);SC.last=ts;if(ts<SC.hold)dt=0;SC.t+=dt;const t=SC.t;
 SC.tws=SC.tws.filter(w=>{if(t<w.st)return true;if(w.from===null)w.from=w.o[w.p];const k=Math.min(1,(t-w.st)/w.dur);w.o[w.p]=w.from+(w.to-w.from)*w.ease(k);return k<1});
 const due=SC.evs.filter(e=>e.t<=t);SC.evs=SC.evs.filter(e=>e.t>t);due.forEach(e=>e.fn());
 const s=dt/1000;SC.parts=SC.parts.filter(p=>{p.age+=dt;if(p.age>=p.life)return false;p.vx+=p.ax*s;p.vy+=p.ay*s;p.vz+=p.az*s;p.x+=p.vx*s;p.y+=p.vy*s;p.z+=p.vz*s;if(p.floor&&p.y<0){p.y=0;p.vy*=-.35;p.vx*=.6;p.vz*=.6}return true});
 SC.clouds.forEach(c=>{c.x+=c.v*s;if(c.x>18)c.x=-18});
 const A=AREAS[SC.area];if(dt>0&&!RM){if(SC.oil&&rnd()<dt/70)part({x:CX0+(rnd()-.5)*8,y:0,z:CZ0+(rnd()-.3)*6,vy:3+rnd()*2,ay:-1,life:2600,spr:'drop',fade:false});
  if(rnd()<dt/180){const am=A.amb,x=CX0+(rnd()-.5)*10,z=CZ0+rnd()*8-1;if(am==='pollen'||am==='spore')part({x,y:.3+rnd()*2.5,z,vx:.3+rnd()*.3,vy:.1,life:4200,col:am==='pollen'?'#FFF2A8':'#B8F0C8',glow:1,size:1});
   else if(am==='drip')part({x,y:6,z,vy:-6,life:1400,col:'#2A2220',size:1,fade:false});else if(am==='sand')part({x:x-5,y:.2+rnd()*2,z,vx:2.5+rnd(),life:3000,col:'#F2D2A0',size:1});
   else part({x,y:.5+rnd()*3,z,vy:.1,life:3000,col:'#FFFFFF',glow:1,size:1,twinkle:1})}}
 SC.shk=Math.max(0,SC.shk-dt*.02);
 if(SC.cv.Mid&&SC.cv.Mid.isConnected){scDraw();camApply()}else SC.on=false}
function camApply(){const t=SC.t,u=SC.u;let sx=0,sy=0;if(SC.shk>.3){sx=(rnd()-.5)*SC.shk;sy=(rnd()-.5)*SC.shk}
 const z=1+SC.css.z,r=SC.css.r+(RM?0:.004*Math.sin(t/4700));
 const set=(id,f,zf)=>{const el=$(id);if(!el)return;const zz=1+(z-1)*zf;el.style.transform=`scale(${zz.toFixed(4)}) rotate(${r.toFixed(4)}rad) translate(${(-sx*f*u).toFixed(2)}px,${(-sy*f*u).toFixed(2)}px)`};
 set('#camSky',.4,.5);set('#camWorld',1,1);const fg=$('#camFg');if(fg){const zz=1+(z-1)*1.3;fg.style.transform=`scale(${zz.toFixed(4)}) rotate(${(r*1.2).toFixed(4)}rad) translate(${((-sx*1.4-SC.cam.yaw*260-(SC.cam.x)*30)*u).toFixed(2)}px,${(-sy*1.4*u).toFixed(2)}px)`}}
function castFloor(){const C=SC.cam,A=AREAS[SC.area],cs=Math.cos(C.yaw),sn=Math.sin(C.yaw),h=H0+C.hz,cy=Math.max(.2,C.y);
 const sky=new Uint32Array(SC.img.Sky.data.buffer),mid=new Uint32Array(SC.img.Mid.data.buffer),near=new Uint32Array(SC.img.Near.data.buffer);mid.fill(0);near.fill(0);
 const NT=SC.near,FT=SC.far,WT=SC.wall,fog=SC.fogC,skyC=SC.skyC,fogD=A.fogD,t=SC.t/1000,indoor=A.indoor;
 const shadows=SC.clouds.map(c=>[c.x,c.z,2.6]);
 let colLz=null;if(indoor){colLz=new Float32Array(LW);const RW=12.5;for(let i=0;i<LW;i++){const a=(i+.5-LW/2)/FOC,dx=a*cs+sn,dz=-a*sn+cs,ox=C.x-CX0,oz=C.z-(CZ0+2),bq=2*(ox*dx+oz*dz),aq=dx*dx+dz*dz,cq=ox*ox+oz*oz-RW*RW,disc=bq*bq-4*aq*cq;colLz[i]=disc>0?(-bq+Math.sqrt(disc))/(2*aq):99}}
 for(let j=0;j<LH;j++){const v=(j+.5-h)/FOC;let lz=indoor?(v>0?cy/v:1e9):RCURV*(-v+Math.sqrt(v*v+2*cy/RCURV));const row=j*LW;
  if(!indoor&&(lz>ZMAX||!(lz>0))){const tt=clamp((h-j)/(h+10),0,1),c=mixA(mixA(fog,skyC[1],Math.min(1,tt*1.6)),skyC[0],Math.max(0,tt*1.6-.6)),pc=pk(c[0],c[1],c[2]);for(let i=0;i<LW;i++)sky[row+i]=pc;continue}
  const fogk=indoor?0:1-Math.exp(-lz/fogD),nearA=lz<3.4?Math.min(1,(3.4-lz)/1.2):0,midA=lz<14?1:lz<19?(19-lz)/5:0;
  for(let i=0;i<LW;i++){let L=lz,pc;
   if(indoor){const wl=colLz[i];if(lz>wl||v<=0){const top=h-FOC*(4.2-cy)/wl,bot=h+FOC*cy/wl;if(j>=top&&j<=bot){const X=C.x+((i+.5-LW/2)/FOC*wl)*cs+wl*sn,Z=C.z-((i+.5-LW/2)/FOC*wl)*sn+wl*cs,ang=Math.atan2(Z-(CZ0+2),X-CX0),u=((Math.floor((ang/(Math.PI*2)+.5)*1024*1.5))%1024+1024)%1024,vv=Math.floor((j-top)/(bot-top)*63);pc=WT[vv*1024+u];L=wl}
     else if(j<top){const g=clamp((top-j)/60,0,1),c=mixA(skyC[2],skyC[0],g);const sk=((i>>3)+(j>>3))%5===0&&g>.2?mixA(c,[150,170,230],.35):c;pc=pk(sk[0],sk[1],sk[2]);sky[row+i]=pc;continue}else{pc=pk(20,16,30)}
     sky[row+i]=pc;if(L<14)mid[row+i]=pc;continue}}
   const lx=(i+.5-LW/2)/FOC*L,X=C.x+lx*cs+L*sn,Z=C.z-lx*sn+L*cs;
   if(L<26||!FT){const u=Math.floor((X-CX0)*TEXS+256)&511,vv=Math.floor((Z-CZ0)*TEXS+256)&511;pc=NT[vv*TEXN+u]}
   if(FT&&L>16){const fu=Math.floor(X*.5)&255,fv=Math.floor(Z*.5)&255,fp=FT[fv*256+fu];if(L>=26||d44(i,j)<(L-16)/10)pc=fp}
   let r=pc&255,g=(pc>>8)&255,b=(pc>>16)&255;
   if(!indoor&&L<60)for(const [cx,cz,cr] of shadows){const d=(X-cx)*(X-cx)+(Z-cz)*(Z-cz);if(d<cr*cr){const q=d/(cr*cr);if(q<.7||d44(i,j)<(1-q)/.3){r*=.74;g*=.76;b*=.86}break}}
   if(fogk>.01){r+=(fog[0]-r)*fogk;g+=(fog[1]-g)*fogk;b+=(fog[2]-b)*fogk}
   const o=pk(r,g,b);sky[row+i]=o;if(midA>0&&(midA>=1||d44(i,j)<midA))mid[row+i]=o;if(nearA>0&&(nearA>=1||d44(i,j)<nearA))near[row+i]=o}}
 SC.cx.Sky.putImageData(SC.img.Sky,0,0);SC.cx.Mid.putImageData(SC.img.Mid,0,0);SC.cx.Near.putImageData(SC.img.Near,0,0)}
function drawShadow(c,X,Z,r,a){const p=proj(X,0,Z);if(!p)return;const w=Math.max(2,r*p.s),hh=Math.max(1.5,w*clamp(SC.cam.y/p.z,.18,.55));c.fillStyle=`rgba(14,8,28,${a})`;
 for(let j=-Math.ceil(hh);j<=Math.ceil(hh);j++){const half=Math.round(w*Math.sqrt(Math.max(0,1-(j/hh)**2)));c.fillRect(Math.round(p.x-half),Math.round(p.y+j),half*2,1)}}
function drawSide(c,i){const s=SC.s[i];if(!s.show||!s.sp||s.a<=.01||s.sc<=.01)return;if(SC.t<s.blinkUntil&&Math.floor(SC.t/60)%2)return;
 const k=KB[i],R=rigParts(s.sp,s.gold,k),view=i===0?'back':'front',buf=SC.buf[i];if(buf.width!==R.BW||buf.height!==R.BH){buf.width=R.BW;buf.height=R.BH}
 const bx=buf.getContext('2d');bx.imageSmoothingEnabled=false;bx.setTransform(1,0,0,1,0,0);bx.clearRect(0,0,buf.width,buf.height);const a=s.act,tau=a?SC.t-a.t0:0,ak=a&&(a.k==='faint'||tau<a.dur)?a.k:null;
 const P=rigPose(ak,tau,Math.floor(SC.t/33)*33,s.seed);drawRig(bx,R,P,view);rigTint(bx,buf.width,buf.height,'#FFFFFF',s.white);rigTint(bx,buf.width,buf.height,'#0C0A16',s.dark);
 const w=sideWorld(i),p=proj(w.x,w.y,w.z);if(!p)return;const sc=p.s*UPP[i]*s.sc,lift=Math.max(0,-P.y)+Math.max(0,-s.oy);
 if(s.a>.5&&ak!=='faint')drawShadow(c,w.x,w.z,R.geo.hw*UPP[i]*.8,.3*(1-Math.min(.6,(lift+R.geo.lift/k)/60)));
 c.globalAlpha=s.a;c.drawImage(buf,Math.round(p.x-R.geo.cx*sc),Math.round(p.y-R.geo.base*sc),Math.round(R.BW*sc),Math.round(R.BH*sc));c.globalAlpha=1}
function drawTrainer(c,i){const T=SC.tr[i];if(!T.show||!T.who||T.a<=0)return;const fr=humanFrames(T.who,i===0?'back':'front'),f=fr[Math.floor(SC.t/700)%2];
 const X=POS[i].x+(i===0?-1.15:1.25)+T.x*UPP[i],Z=POS[i].z+(i===0?.25:.4),p=proj(X,0,Z);if(!p)return;const sc=p.s*UPP[i]*(i===0?2:1.15),w=32*sc,h=44*sc;
 if(i===1)drawShadow(c,X,Z,.35,.22);c.globalAlpha=T.a;c.drawImage(f,Math.round(p.x-w/2),Math.round(p.y-h),Math.round(w),Math.round(h));c.globalAlpha=1}
function drawBill(c,img,X,Y,Z,wk,al){const p=proj(X,Y,Z);if(!p)return;const sc=p.s/30*wk;if(sc>8)return;c.globalAlpha=al==null?1:al;c.drawImage(img.c,Math.round(p.x+img.ox*sc),Math.round(p.y+img.oy*sc),Math.max(1,Math.round(img.W*sc)),Math.max(1,Math.round(img.H*sc)));c.globalAlpha=1}
function pixRing(c,cx,cy,rx,ry,col,th=1){c.fillStyle=col;const n=Math.max(24,Math.round((rx+ry)*2));for(let k=0;k<n;k++){const a=k/n*Math.PI*2;for(let q=0;q<th;q++)c.fillRect(Math.round(cx+Math.cos(a)*(rx-q)),Math.round(cy+Math.sin(a)*(ry-q)),1,1)}}
const SPRC={};function partSpr(key){return SPRC[key]||(SPRC[key]=iconCanvas(key))}
function drawParts(c,layer){const L=[];SC.parts.forEach(p=>{if((p.layer||2)!==layer)return;const q=proj(p.x,p.y,p.z);if(q)L.push([q,p])});L.sort((a,b)=>b[0].z-a[0].z);
 L.forEach(([q,p])=>{let fade=p.fade===false?1:1-p.age/p.life;if(p.twinkle)fade*=.5+.5*Math.sin(p.age/120);c.globalAlpha=Math.max(0,Math.min(1,fade));if(p.glow)c.globalCompositeOperation='lighter';
  const k=clamp(q.s/30*(p.k||1),.5,5);
  if(p.ring){const r=(p.r0+(p.r1-p.r0)*EASE.out(p.age/p.life))*q.s/30;pixRing(c,q.x,q.y,r,p.ground?r*clamp(SC.cam.y/q.z,.2,.6):r,p.col,p.ground?2:Math.max(1,Math.round(k)))}
  else if(p.spr){const s=partSpr(p.spr),kk=Math.max(1,Math.round(k*2)/2);c.drawImage(s,Math.round(q.x-s.width*kk/2),Math.round(q.y-s.height*kk/2),Math.round(s.width*kk),Math.round(s.height*kk))}
  else if(p.beam){const q2=proj(p.x2,p.y2,p.z2);if(q2){c.strokeStyle=p.col;c.lineWidth=Math.max(1,p.w*k);c.lineCap='round';c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q2.x,q2.y);c.stroke();c.strokeStyle='#FFFFFF';c.lineWidth=Math.max(1,p.w*k*.35);c.stroke()}}
  else{c.fillStyle=p.col;const sz=Math.max(1,Math.round((p.size||2)*k*.6));c.fillRect(Math.round(q.x),Math.round(q.y),sz,sz)}c.globalCompositeOperation='source-over'});c.globalAlpha=1}
function scDraw(){const X=SC.cx,t=SC.t;castFloor();
 const sk=X.Sky;if(!AREAS[SC.area].indoor){const g=sk.createLinearGradient(0,0,0,H0);g.addColorStop(0,'rgba(255,246,214,.55)');g.addColorStop(1,'rgba(255,246,214,0)');sk.globalCompositeOperation='lighter';sk.fillStyle=g;
  for(let n=0;n<4;n++){const x=LW*(.15+n*.24)-SC.cam.yaw*300+Math.sin(t/3000+n)*6;sk.globalAlpha=.16+.06*Math.sin(t/1700+n*2);sk.beginPath();sk.moveTo(x-6,0);sk.lineTo(x+8,0);sk.lineTo(x+30,H0+20);sk.lineTo(x+4,H0+20);sk.fill()}sk.globalAlpha=1;sk.globalCompositeOperation='source-over'}
 const bills=[];SC.props.forEach(p=>{const q=proj(p.x,0,p.z);if(q)bills.push({z:q.z,draw:c=>{if(!p.P.flat)drawShadow(c,p.x,p.z,.45*Math.min(2,p.h*.5),.22);drawBill(c,p.img,p.x,0,p.z,1)}})});
 SC.clouds.forEach(cl=>{const q=proj(cl.x,cl.y,cl.z);if(q)bills.push({z:q.z,sky:1,draw:c=>drawBill(c,cl.img,cl.x,cl.y,cl.z,2,.92)})});
 bills.sort((a,b)=>b.z-a.z);
 const m=X.Mid,n=X.Near;bills.forEach(b=>{const c=b.sky||b.z>9?sk:b.z<3.2?n:m;b.draw(c)});
 drawParts(m,0);drawTrainer(m,1);drawSide(m,1);drawTrainer(n,0);drawSide(n,0);
 const f=X.Fx;f.clearRect(0,0,LW,LH);
 if(SC.coin&&SC.coin.show){const C=SC.coin,q=proj(C.x,C.y,C.z);if(q){const cc=coinCanvas(C.kind,16),k=clamp(q.s/30*(C.k||1),.6,4);f.save();f.translate(Math.round(q.x),Math.round(q.y));f.rotate(C.rot||0);f.drawImage(cc,-8*k,-8*k,16*k,16*k);if(C.glow>0){f.globalAlpha=C.glow;f.drawImage(whiteOf(cc),-8*k,-8*k,16*k,16*k)}f.restore();f.globalAlpha=1}}
 if(SC.ring){const ph=scRingPhase(),o=sideCenter(1),q=proj(o.x,o.y,o.z);if(q){const r=(1.15-ph*.8)*q.s;const col=ph>.62?'#5DFF8A':ph>.35?'#F4C542':'#F2F2F2';pixRing(f,q.x,q.y,r,r,col,2);f.globalAlpha=.35;pixRing(f,q.x,q.y,r+3,r+3,ph>.62?'#5DFF8A':'#FFFFFF',1);f.globalAlpha=1;
  const g=proj(o.x,0,o.z);if(g){f.globalAlpha=.5;pixRing(f,g.x,g.y,r*.9,r*.9*clamp(SC.cam.y/g.z,.2,.6),col,1);f.globalAlpha=1}}}
 drawParts(f,1);drawParts(f,2)}
const scRingPhase=()=>SC.ring?((SC.t-SC.ring.t0)%1300)/1300:0;
/* ---------- effects (world space, y up) ---------- */
function part(o){SC.parts.push(Object.assign({vx:0,vy:0,vz:0,ax:0,ay:0,az:0,age:0,life:600,layer:2},o))}
const TFX={Tech:['bit','bit','up'],Crypto:['vcoin','gem'],Oil:['drop'],Retail:['cbox','coin'],Media:['bubble','bolt'],Finance:['dollar','coin'],Dynasty:['spark','coin'],Space:['star','spark'],Property:['brick'],None:['pow','star']};
const GLOWY={spark:1,star:1,bolt:1,bit:1,gem:1,pow:1,up:1};
const tspr=(t,i)=>{const l=TFX[t]||TFX.None;return l[i%l.length]};
function burst(P,t,n=10,sp=2.2,k=1){for(let i=0;i<n;i++){const a=rnd()*Math.PI*2,b=(rnd()-.3)*Math.PI*.6,v=sp*(.5+rnd()),key=tspr(t,i);part({x:P.x,y:P.y,z:P.z,vx:Math.cos(a)*Math.cos(b)*v,vy:Math.sin(b)*v+1.2,vz:Math.sin(a)*Math.cos(b)*v,ay:-5,life:460+rnd()*300,spr:key,k,glow:GLOWY[key]})}}
function ringFx(P,col='#FFFFFF',r0=.15,r1=1.1,life=380){part({x:P.x,y:P.y,z:P.z,ring:1,r0:r0*30,r1:r1*30,col,life})}
function groundRing(i,col='#FFFFFF',r1=1.6,life=520){const w=sideWorld(i);part({x:w.x,y:.02,z:w.z,ring:1,ground:1,r0:6,r1:r1*30,col,life,layer:i===0?2:2})}
function blinkSide(i,ms=380){SC.s[i].blinkUntil=SC.t+ms}
function hitFx(ti,an){const T=sideCenter(ti),s=SC.s[ti];act(ti,'hurt',650);tw(s,'ox',(ti===1?6:-6),60);tw(s,'ox',0,200,'out',60);
 if(an.te>1){SC.shk=8;scFlash('#FFFFFF',.55,260);scCA(180);hitStop(80);ringFx(T,'#FFFFFF',.2,1.6);groundRing(ti,'#FFFFFF',2.2);tw(SC.css,'z',.06,60,'out');tw(SC.css,'z',0,260,'io',80)}else{SC.shk=Math.max(SC.shk,3);hitStop(35);groundRing(ti,'#FFFFFF',1.4,380)}
 if(an.crit){scFlash('#FFF2A8',.6,300);hitStop(90)}
 burst(T,an.t||'None',an.te>1?16:10,an.te>1?3.2:2.2,1)}
function camTo(c,d=260,e='io',delay=0){for(const k in c)if(k in SC.cam)tw(SC.cam,k,c[k],d,e,delay)}
function camHome(d=420,delay=0){camTo(HOMECAM,d,'io',delay);tw(SC.css,'r',0,d,'io',delay)}
const camAt=(i,amt=.45,z=.14,rr=0,d=260,e='io')=>{const F=FOCAM[i],k=clamp(amt*2.1,0,1),c={};for(const key in HOMECAM)c[key]=HOMECAM[key]+(F[key]-HOMECAM[key])*k;
 const w=sideWorld(i),dx=w.x-c.x,dz=w.z-c.z,L=Math.hypot(dx,dz),dd=Math.min(L*.45,z*5);c.x+=dx/L*dd;c.z+=dz/L*dd;camTo(c,d,e);tw(SC.css,'r',rr,d,e)};
function coinArc(from,to,dur,kind,onLand,spin){const C={kind,x:from.x,y:from.y,z:from.z,show:true,rot:0,k:1.6,glow:0};SC.coin=C;const t0=SC.t;
 const step=()=>{const k=Math.min(1,(SC.t-t0)/dur);C.x=from.x+(to.x-from.x)*k;C.z=from.z+(to.z-from.z)*k;C.y=from.y+(to.y-from.y)*k+Math.sin(k*Math.PI)*1.6;C.rot=k*Math.PI*(spin?6:3);if(k<1)at(16,step);else{C.rot=0;onLand&&onLand(C)}};step();return C}
const CAMPOS=()=>({x:SC.cam.x-.9,y:SC.cam.y-.6,z:SC.cam.z+.6});
function scPlay(an,ev){scFlush();const s0=SC.s[0],s1=SC.s[1];const syncSide=i=>{const sn=ev&&ev.s[i];if(sn){SC.s[i].sp=sn.sp;SC.s[i].gold=sn.gold}};
 switch(an.k){
 case 'wild':{syncSide(1);Object.assign(s1,{show:true,ox:0,dark:1,a:1,sc:1,white:0});SC.tr[0]={who:S.gender||'boy',show:true,x:0,a:1};
  Object.assign(SC.cam,{x:3.6,y:1.1,z:2.4,yaw:-.62,hz:14});SC.css.r=-.03;scFocus('foe');tw(s1,'dark',0,380,'lin',700);
  at(700,()=>{act(1,'enter',700);ringFx(sideCenter(1),'#FFFFFF',.1,.9);groundRing(1,'#FFFFFF',1.8)});camHome(1100,150);at(1250,()=>scFocus('wide'));return{dur:1250,hit:0}}
 case 'trainerIn':{SC.tr[1]={who:an.who,show:true,x:120,a:1};SC.tr[0]={who:S.gender||'boy',show:true,x:-120,a:1};tw(SC.tr[1],'x',0,560,'out3');tw(SC.tr[0],'x',0,560,'out3');
  Object.assign(SC.cam,{x:-2.6,y:1.9,z:-.8,yaw:.5,hz:-6});SC.css.r=.02;scFocus('me');at(450,()=>scFocus('foe'));camHome(1100,100);at(1200,()=>scFocus('wide'));return{dur:1150,hit:0}}
 case 'enter':{const i=an.si,s=SC.s[i];syncSide(i);Object.assign(s,{show:false,ox:0,oy:0,sc:0,a:1,white:1,dark:0,act:null});const T=SC.tr[i];
  if(T.show){tw(T,'x',i===0?-140:140,320,'in');at(330,()=>{T.show=false})}scFocus(i===0?'me':'foe');camAt(i,.35,.1,i===0?-.012:.012,300);
  const w=sideWorld(i),from=i===0?CAMPOS():{x:w.x+2.4,y:2.2,z:w.z+1.6},to={x:w.x,y:.4,z:w.z};
  coinArc(from,to,380,'penny',C=>{C.show=false;s.show=true;const c=sideCenter(i);ringFx(c,'#FFFFFF',.1,i===0?1.3:1);groundRing(i,'#FFFFFF',2);burst(c,'Dynasty',10,2,1);scFlash('#FFFFFF',.25,200);tw(s,'sc',1,300,'back');tw(s,'white',0,320,'lin',120);act(i,'enter',700)});
  camHome(520,560);at(950,()=>scFocus('wide'));return{dur:900,hit:0}}
 case 'recall':{const s=SC.s[an.si];act(an.si,'block',500);tw(s,'white',1,160,'lin',120);tw(s,'sc',0,220,'in',260);at(500,()=>{s.show=false;s.sc=1;s.white=0});return{dur:540,hit:0}}
 case 'faint':{const i=an.si,s=SC.s[i];act(i,'faint',99999);scFocus(i===0?'me':'foe');camAt(i,.3,.08,i===0?.02:-.02,500);tw(s,'oy',10,500,'in',450);tw(s,'a',0,420,'in',560);at(700,()=>groundRing(i,'#C8C0E0',1.6,500));at(1000,()=>{s.show=false;s.oy=0;s.a=1;s.act=null});SC.shk=2.5;camHome(500,900);at(1100,()=>scFocus('wide'));return{dur:1050,hit:0}}
 case 'move':{const si=an.si,ti=1-si,M=MOVES[an.mid],me=SC.s[si],dir=si===0?1:-1;an.t=M.t;const A=sideCenter(si),T=sideCenter(ti),kk=1;
  scFocus(si===0?'me':'foe');camAt(si,.32,.08,si===0?-.012:.012,200);
  const ak=an.protect?'block':M.c==='H'?'attack':M.c==='S'?'cast':an.self?'buff':'cast';act(si,ak,ak==='attack'?620:800);
  const toT=(d=180)=>{scFocus(ti===0?'me':'foe');camAt(ti,.45,.15,ti===1?.022:-.022,d,'out3')};
  if(an.miss){if(M.c==='H'){tw(me,'ox',dir*22,110);tw(me,'ox',0,160,'out',120)}else for(let i=0;i<6;i++)at(i*45,()=>part({x:A.x,y:A.y,z:A.z,vx:(T.x-A.x)*3.2+(rnd()-.5),vy:(T.y-A.y)*3.2+1.5,vz:(T.z-A.z)*3.2+1.2,life:380,spr:tspr(M.t,i),k:kk}));
   const ts=SC.s[ti];at(150,()=>{toT();tw(ts,'ox',ts.ox-dir*18,100);tw(ts,'ox',0,180,'out',160)});camHome(420,560);at(900,()=>scFocus('wide'));return{dur:760,hit:999}}
  if(an.protect){at(140,()=>{ringFx(A,'#8FD8FF',.3,1.1,600);ringFx(A,'#FFFFFF',.1,.8,450);groundRing(si,'#8FD8FF',1.8,600)});camHome(400,500);at(800,()=>scFocus('wide'));return{dur:700,hit:0}}
  if(an.blocked){at(170,()=>{toT();ringFx(T,'#8FD8FF',.4,.9,420);act(ti,'block',500)});camHome(400,520);at(900,()=>scFocus('wide'));return{dur:740,hit:999}}
  if(M.c==='H'){tw(me,'ox',dir*30,120,'in',100);tw(me,'oy',-4,120,'in',100);tw(me,'ox',0,200,'out',240);tw(me,'oy',0,200,'out',240);at(120,()=>{for(let i=0;i<5;i++)part({x:A.x,y:.15,z:A.z,vx:(rnd()-.5)*1.2,vy:.6+rnd()*.6,vz:(rnd()-.5)*1.2,life:420,col:'#E8DCC8',size:2,floor:1})});
   at(200,()=>{toT(140);if(an.dmg)hitFx(ti,an)});camHome(460,620);at(1050,()=>scFocus('wide'));return{dur:880,hit:200}}
  if(M.c==='S'){const n=9,beamy=M.t==='Space'||M.t==='Tech'||M.t==='Media';at(140,()=>{ringFx(A,TC[M.t][0],.15,.8,300);groundRing(si,TC[M.t][0],1.4,420)});
   if(beamy)at(200,()=>part({x:A.x,y:A.y,z:A.z,x2:T.x,y2:T.y,z2:T.z,beam:1,col:TC[M.t][0],w:3,life:420,glow:1}));
   for(let i=0;i<n;i++)at(160+i*34,()=>{const v=1/.32,key=tspr(M.t,i);part({x:A.x+(rnd()-.5)*.2,y:A.y+(rnd()-.5)*.2,z:A.z,vx:(T.x-A.x)*v,vy:(T.y-A.y)*v+2.4,vz:(T.z-A.z)*v,ay:-15,life:320,spr:key,k:1.2,fade:false,glow:GLOWY[key]})});
   at(330,()=>toT(220));if(an.dmg)at(500,()=>hitFx(ti,an));camHome(480,820);at(1250,()=>scFocus('wide'));return{dur:1060,hit:500}}
  const tgt=an.self?si:ti,Pp=an.self?A:T,tk=1;if(!an.self)at(260,()=>toT(240));
  for(let i=0;i<10;i++)at(200+i*48,()=>{const a=i/10*Math.PI*2,key=tspr(M.t,i);part({x:Pp.x+Math.cos(a)*.8,y:Pp.y+Math.sin(a*2)*.3,z:Pp.z+Math.sin(a)*.8,vx:-Math.cos(a)*1.2,vy:.8,vz:-Math.sin(a)*1.2,life:440,spr:key,k:tk,glow:GLOWY[key]})});
  at(600,()=>{ringFx(Pp,TC[M.t][0],.2,1.1,420);groundRing(tgt,TC[M.t][0],1.6);if(!an.self){blinkSide(tgt,240);act(tgt,'dizzy',700)}});camHome(460,800);at(1250,()=>scFocus('wide'));return{dur:1000,hit:600}}
 case 'hurt':{const T=sideCenter(an.si),kk=1;act(an.si,'hurt',600);blinkSide(an.si,360);SC.shk=2.5;
  if(an.fx==='oil')for(let i=0;i<7;i++)part({x:T.x+(rnd()-.5)*.8,y:.1,z:T.z+(rnd()-.5)*.5,vy:3+rnd()*2,ay:-6,life:620,spr:'drop',k:kk});
  if(an.fx==='rent')burst(T,'Property',7,1.6,kk);if(an.fx==='scn')for(let i=0;i<4;i++)at(i*70,()=>part({x:T.x+(rnd()-.5)*.8,y:T.y+.6,z:T.z,vy:1,life:520,spr:'excl',k:kk}));
  if(an.fx==='mail'){scFocus(an.si===0?'me':'foe');coinArc({x:T.x+3,y:4,z:T.z+2},T,380,'gold',C=>{C.show=false;hitFx(an.si,{te:an.te,t:'Retail'})});at(1000,()=>scFocus('wide'));return{dur:900,hit:400}}return{dur:560,hit:80}}
 case 'heal':{const T=sideCenter(an.si),kk=1;act(an.si,'cheer',700);for(let i=0;i<12;i++)at(i*45,()=>part({x:T.x+(rnd()-.5)*1.2,y:.2,z:T.z+(rnd()-.5)*.6,vy:2+rnd(),life:650,spr:i%3?'plus':'spark',k:kk,glow:i%3?0:1}));
  groundRing(an.si,'#5DFF8A',1.5,600);tw(SC.s[an.si],'white',.35,150);tw(SC.s[an.si],'white',0,260,'lin',160);return{dur:720,hit:200}}
 case 'stat':{const T=sideCenter(an.si),kk=1;act(an.si,an.up?'buff':'dizzy',700);for(let i=0;i<9;i++)at(i*55,()=>part({x:T.x+(rnd()-.5)*1.4,y:an.up?.2:T.y+.8,z:T.z+(rnd()-.5)*.6,vy:an.up?2.6:-2.6,life:540,spr:an.up?'up':'down',k:kk,glow:an.up?1:0}));
  if(an.up)groundRing(an.si,'#8FD8FF',1.6,520);tw(SC.s[an.si],'white',.3,120);tw(SC.s[an.si],'white',0,240,'lin',140);return{dur:680,hit:0}}
 case 'status':{const T=sideCenter(an.si),kk=1,sp=an.st==='aud'?'sheet':an.st==='sub'?'zz':'excl';act(an.si,'dizzy',800);for(let i=0;i<8;i++)at(i*60,()=>part({x:T.x+(rnd()-.5)*1.2,y:T.y+.9,z:T.z,vx:(rnd()-.5)*.8,vy:an.st==='aud'?-1.6:1.4,life:620,spr:sp,k:kk}));
  blinkSide(an.si,300);return{dur:700,hit:0}}
 case 'hype':{const T=sideCenter(an.si),kk=1;act(an.si,'dizzy',800);for(let i=0;i<7;i++)at(i*60,()=>{const a=i/7*Math.PI*2;part({x:T.x+Math.cos(a)*.5,y:T.y+.8,z:T.z+Math.sin(a)*.5,vx:-Math.sin(a)*.8,vz:Math.cos(a)*.8,vy:.4,life:520,spr:'star',k:kk,glow:1})});return{dur:640,hit:0}}
 case 'cry':{const s=SC.s[an.si];act(an.si,'smug',900);camAt(an.si,.3,.1,an.si===1?.012:-.012,260);scFocus(an.si===0?'me':'foe');tw(s,'oy',-7,110,'out');tw(s,'oy',0,140,'in',110);tw(s,'oy',-5,100,'out',260);tw(s,'oy',0,130,'in',360);at(120,()=>groundRing(an.si,'#FFFFFF',1.2,380));camHome(400,520);at(800,()=>scFocus('wide'));return{dur:700,hit:0}}
 case 'market':{SC.oil=true;for(let i=0;i<24;i++)part({x:CX0+(rnd()-.5)*9,y:0,z:CZ0+(rnd()-.4)*7,vy:5+rnd()*3,ay:-4,life:1300,spr:'drop',k:rnd()<.3?2:1});scFlash('#000000',.35,500);SC.shk=3;return{dur:760,hit:0}}
 case 'marketEnd':{SC.oil=false;return{dur:200,hit:0}}
 case 'caught':{const C=SC.coin;if(C){for(let i=0;i<10;i++)part({x:C.x,y:C.y,z:C.z,vx:(i-4.5)*.5,vy:3,ay:-6,life:720,spr:'spark',glow:1});tw(C,'glow',.8,120);tw(C,'glow',0,300,'lin',140)}return{dur:720,hit:0}}
 case 'lvl':{if(!SC.s[0].show)return{dur:0,hit:0};const T=sideCenter(0);act(0,'cheer',900);scFocus('me');camAt(0,.3,.08,-.012,300);ringFx(T,'#F4C542',.2,1.5,520);groundRing(0,'#F4C542',2,600);for(let i=0;i<10;i++)part({x:T.x+(rnd()-.5)*1.4,y:.2,z:T.z+(rnd()-.5)*.5,vy:2.6,life:620,spr:'spark',k:1,glow:1});camHome(400,500);at(900,()=>scFocus('wide'));return{dur:700,hit:0}}
 }return{dur:0,hit:0}}
function scCatch(kind,res,spin,done){scFlush();const s1=SC.s[1],o=sideCenter(1),w=sideWorld(1),land={x:w.x,y:.25,z:w.z};camAt(1,.5,.18,.02,320);scFocus('foe');
 coinArc(CAMPOS(),{x:o.x,y:o.y,z:o.z},480,kind,C=>{scFlash('#FFFFFF',.55,280);ringFx(C,'#FFFFFF',.1,1);tw(s1,'white',1,120,'lin');tw(s1,'sc',0,220,'in',120);
  at(360,()=>{s1.show=false;tw(C,'y',land.y,300,'in');at(300,()=>{SC.shk=1.5;groundRing(1,'#FFFFFF',1,300);tw(C,'y',land.y+.25,110,'out');tw(C,'y',land.y,120,'in',110)});
   let t=760;for(let k=0;k<res.w;k++){at(t,()=>{tw(SC.css,'z',.06+k*.03,200,'out');tw(C,'rot',-.42,150,'out');tw(C,'rot',.42,240,'io',150);tw(C,'rot',0,140,'in',390)});t+=820}
   at(t,()=>{tw(SC.css,'z',0,300,'io');if(res.caught){C.glow=0;for(let i=0;i<12;i++)part({x:C.x,y:C.y,z:C.z,vx:(rnd()-.5)*3,vy:2+rnd()*2,vz:(rnd()-.5)*2,ay:-5,life:720,spr:'star',glow:1});tw(C,'glow',.9,100);tw(C,'glow',0,300,'lin',120);scFlash('#FFF2A8',.3,400);at(900,()=>done(true))}
    else{scFlash('#FFFFFF',.6,300);ringFx(C,'#FFFFFF',.1,1.1);C.show=false;s1.show=true;s1.sc=0;s1.white=1;tw(s1,'sc',1,220,'back');tw(s1,'white',0,260,'lin',80);act(1,'smug',800);camHome(400,200);at(700,()=>scFocus('wide'));at(620,()=>done(false))}})})},spin)}
