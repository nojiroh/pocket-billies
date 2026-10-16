/* ================= ART EXPORTER =================
   Runs the procedural generators in tools/src and turns every piece of artwork into image files.
   Driven by tools/build-art.py (Playwright). Each EXPORT.* function returns [{path, url|text}]. */
'use strict';
const KBACK=1.4;
const png=c=>c.toDataURL('image/png');
function texToCanvas(T,W,H){const c=cnv(W,H),x=c.getContext('2d'),id=new ImageData(new Uint8ClampedArray(T.buffer.slice(0)),W,H);x.putImageData(id,0,0);return c}
/* shelf packer: frames [{w,h,...}] -> sets x,y; returns atlas size */
function pack(frames,maxW=256,pad=1){const order=frames.map((f,i)=>i).sort((a,b)=>frames[b].h-frames[a].h||frames[b].w-frames[a].w);let x=pad,y=pad,rowH=0,W=0;
 const widest=Math.max(...frames.map(f=>f.w))+pad*2;maxW=Math.max(maxW,widest);
 for(const i of order){const f=frames[i];if(x+f.w+pad>maxW){x=pad;y+=rowH+pad;rowH=0}f.x=x;f.y=y;x+=f.w+pad;rowH=Math.max(rowH,f.h);W=Math.max(W,x)}
 return {w:W,h:y+rowH+pad}}
function drawAtlas(frames,size){const c=cnv(size.w,size.h),x=c.getContext('2d');frames.forEach(f=>x.drawImage(f.c,f.x,f.y));return c}
const EXPORT={
 /* one billionaire: front parts at 2x, back-view parts at 2.8x, each in normal and gold-plated colors */
 species(id){const out=[],rig={};
  for(const view of ['front','back']){const k=(view==='front'?1:KBACK)*2;let rects=null,size=null,meta=null;
   for(const gold of [0,1]){const R=rigParts(id,gold,k),seen=new Map(),imgs=[],frames=[];
    const bones=R.bones.map(b=>{let im=view==='front'?b.img:(b.hideB?null:(b.imgB||b.img));if(!im)return {b,i:-1};
     if(!seen.has(im)){seen.set(im,imgs.length);const e={ox:im.ox,oy:im.oy,f:{}};const vs=im.v?Object.keys(im.v):['main'];vs.forEach(v=>{const c=im.v?im.v[v]:im.c;const fr={c,w:c.width,h:c.height,img:imgs.length,v};frames.push(fr)});imgs.push(e)}
     return {b,i:seen.get(im)}});
    if(!gold){size=pack(frames,512);rects=frames.map(f=>[f.x,f.y,f.w,f.h]);frames.forEach(f=>{imgs[f.img].f[f.v]=[f.x,f.y,f.w,f.h]});
     meta={k,BW:R.BW,BH:R.BH,cx:R.cx,base:R.base,tipX:R.tipX||0,plan:R.plan,q:R.q,geo:R.geo,size:[size.w,size.h],imgs,
      bones:bones.map(({b,i})=>{const o={n:b.n,at:[+b.at[0].toFixed(3),+b.at[1].toFixed(3)],z:b.z,i};if(b.par)o.par=b.par;if(b.rr)o.rr=+b.rr.toFixed(4);if(b.zb!=null)o.zb=b.zb;if(b.face)o.face=1;if(b.hideB)o.hideB=1;return o})}}
    else{if(frames.length!==rects.length)throw new Error(id+' gold frame count differs');frames.forEach((f,j)=>{f.x=rects[j][0];f.y=rects[j][1];if(f.w!==rects[j][2]||f.h!==rects[j][3])throw new Error(id+' gold frame size differs')})}
    out.push({path:`art/billionaires/${id}${view==='back'?'_back':''}${gold?'_gold':''}.png`,url:png(drawAtlas(frames,size))})}
   rig[view]=meta}
  return {files:out,rig}},
 icons(){const frames=[];Object.keys(ICONS).forEach(k=>{const c=iconCanvas(k,1);frames.push({key:k,c,w:c.width,h:c.height})});
  Object.keys(MSTAMP).forEach(k=>{const c=mstamp(k);frames.push({key:'map_'+k,c,w:c.width,h:c.height})});
  const size=pack(frames,256),man={};frames.forEach(f=>man[f.key]=[f.x,f.y,f.w,f.h]);return {files:[{path:'art/icons/icons.png',url:png(drawAtlas(frames,size))}],man}},
 ui(){return Object.keys(UIICO).map(key=>{const g=UIICO[key];let r='';g.forEach((row,j)=>{for(let i=0;i<row.length;i++)if(row[i]==='k')r+=`M${i} ${j}h1v1h-1z`});
  return {path:`art/ui/${key}.svg`,text:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" shape-rendering="crispEdges"><path d="${r}" fill="#000"/></svg>\n`}})},
 coins(){const out=[];Object.keys(COINR).forEach(kind=>[16,32].forEach(s=>out.push({path:`art/coins/${kind}_${s}.png`,url:png(coinCanvas(kind,s))})));return out},
 eggs(){const out=[];[2,5,10].forEach(t=>{out.push({path:`art/eggs/egg_${t}.png`,url:png(eggCanvas(t))});out.push({path:`art/eggs/egg_${t}_cracked.png`,url:png(eggCanvas(t,true))})});return out},
 people(){const out=[];Object.keys(PEOPLE).forEach(who=>{['front','back'].forEach(view=>{const fr=humanFrames(who,view),c=cnv(fr[0].width*2,fr[0].height),x=c.getContext('2d');fr.forEach((f,i)=>x.drawImage(f,i*f.width,0));out.push({path:`art/people/${who}_${view}.png`,url:png(c)})});
  const o=owFrames(who),rows=['down','up','side','sideR'],c=cnv(32*3,40*4),x=c.getContext('2d');rows.forEach((r,j)=>o[r].forEach((f,i)=>x.drawImage(f,i*32,j*40)));out.push({path:`art/people/${who}_walk.png`,url:png(c)})});return out},
 battle(){const out=[],areas={},propImgs={},usedFar=new Set();
  for(const key of Object.keys(AREAS)){const A=AREAS[key];
   out.push({path:`art/battle/${key}_ground.png`,url:png(texToCanvas(buildNearTex(key),TEXN,TEXN))});
   out.push({path:`art/battle/${key}_foreground.png`,url:png(buildFg(key))});
   if(A.wall)out.push({path:`art/battle/${key}_walls.png`,url:png(texToCanvas(buildWallTex(key),1024,64))});
   if(A.far)usedFar.add(A.far);
   const r=seeded(key.length*97+3),L=[];for(let n=0;n<34;n++){const a=r()*Math.PI*2,d=4.2+r()*(A.indoor?7:13),x=CX0+Math.cos(a)*d*1.3,z=CZ0+2+Math.sin(a)*d;if(z<1.2||Math.abs(x-(-2.6+Math.sin(z*.32)*1.2))<1&&!A.indoor||POS.some(q=>Math.hypot(x-q.x,z-q.z)<2.4)||(x>-1.8&&x<3.4&&z<7.8))continue;
    const kind=A.props[n%A.props.length],P=PROPB[kind](r);L.push({kind,x:+x.toFixed(3),z:+z.toFixed(3)});
    if(!propImgs[kind]){const im=bake(P.mk(),P.k||1);propImgs[kind]={ox:im.ox,oy:im.oy,h:+P.h.toFixed(2),flat:P.flat?1:0};out.push({path:`art/battle/props/${kind}.png`,url:png(im.c)})}}
   areas[key]={props:L}}
  usedFar.forEach(kind=>out.push({path:`art/battle/far_${kind}.png`,url:png(texToCanvas(buildFarTex(kind),256,256))}));
  const clouds=[];for(let i=0;i<6;i++){const im=bake(cloudPart(i*31+7),1);clouds.push({ox:im.ox,oy:im.oy});out.push({path:`art/battle/cloud_${i}.png`,url:png(im.c)})}
  return {files:out,man:{areas,props:propImgs,clouds}}},
 map(){buildWorldTex();return [{path:'art/map/world.png',url:png(texToCanvas(WTX.T,TW,TH))}]},
 bg(){const out=[];for(const dk of [false,true]){const W=160,H=360,c=cnv(W,H),P=pxCtx(c);const sky=dk?['#07060F','#100C22','#1C1538','#2B1F4C','#3A2758','#4A2E5E']:['#C7B4E2','#DCC0DE','#EECAC8','#F6D6BE','#FAE4C8','#FDF0DA'];
   for(let y=0;y<H;y++)for(let x=0;x<W;x++)P.set(x,y,gradCol(sky,y/(H*.9),x,y));
   const r=seeded(77);for(let x=0;x<W;x++){const h=10+Math.round(4*Math.sin(x/13)+2*Math.sin(x/5.3));for(let y=0;y<h;y++)P.set(x,y,y<2?(dk?'#05040A':'#9A86B8'):mixHex(dk?'#2A2448':'#A48ABE',sky[0],.45))}
   for(let k=0;k<10;k++){const hx=Math.floor(r()*W),hy=8+Math.round(4*Math.sin(hx/13));const wc=mixHex(dk?'#4A3E70':'#B89AC0',sky[0],.4);for(let j=0;j<2;j++)for(let i=0;i<4;i++)P.set(hx+i,hy+j,wc);for(let i=-1;i<5;i++)P.set(hx+i,hy+2,mixHex('#C8607A',sky[0],.5));if(r()<.7)P.set(hx+1,hy,dk?'#FFE08A':'#FFF2C0')}
   P.done();out.push({path:`art/background/sky_${dk?'dark':'light'}.png`,url:png(c)});
   [0,1,2,3].forEach(i=>out.push({path:`art/background/cloud_${dk?'dark':'light'}_${i}.png`,url:png(cloudSprite(i*7+(dk?50:0),20+i*6,8+i*2,dk?['#1C1538','#2B1F4C','#3A2E62','#4E3E78']:['#E2B8C8','#F0CCD0','#FFF6EC','#FFFFFF']))}))}
  [0,1,2].forEach(i=>{const w=26+i*10,h=16+i*4,ic=cnv(w,h+10),Q=pxCtx(ic);const rr=seeded(i*19+3);
   for(let y=0;y<h;y++){const half=w/2*(1-Math.pow(y/h,1.6));for(let x=Math.round(w/2-half);x<w/2+half;x++)Q.set(x,y+6,y<3?(y<1?'#8FD07A':'#5DA04E'):(y<5?'#6E5240':gradCol(['#5A4236','#3A2A24'],y/h,x,y)))}
   for(let k=0;k<2+i;k++){const tx=4+Math.floor(rr()*(w-8));blob(Q,tx,4,2.4,2.4,['#2E5A36','#3E7A44','#5DA04E','#8FD07A'])}
   const hx=Math.floor(w*.55);for(let j=0;j<3;j++)for(let ii=0;ii<4;ii++)Q.set(hx+ii,3+j,'#F0E6D2');for(let ii=-1;ii<5;ii++)Q.set(hx+ii,2,'#D9434B');Q.set(hx+1,4,'#FFE08A');Q.done();
   out.push({path:`art/background/island_${i}.png`,url:png(ic)})});
  return out},
};
