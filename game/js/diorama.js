'use strict';
/* ================= WALK SCENE: a tilt-shift diorama of the current route stop =================
   The ground is a tile map (scene.tiles, one character per tile) painted into a texture and projected row by row,
   like a camera looking down at a model railway. Props, people and hidden encounters are upright pixel billboards
   that cast soft sun shadows. Distant hills (scene.far) stand behind the scene, haze grows with distance and a blur
   that grows toward the top and bottom of the screen gives the miniature (tilt-shift) look.
   v10: the player walks around freely (tap the ground, a building, a trainer, a road sign), townsfolk wander,
   chimneys smoke, fountains splash, windmills turn, butterflies and leaves drift by.
   Scenes and the prop catalog live in game data (scenes, scenery) and are edited in Pocket Billies Studio. */
const DIO={cv:null,x:null,id:null,sc:null,ground:null,gkey:'',t:0,cam:null,C:null,st:{},
 pl:{t:-1,walk:0,dir:'down',x:0,z:0,route:null,ri:0,goal:null,line:null,d:0,pk:'',fresh:true,saved:0,rust:0,face:null},
 hits:[],R:1,slow:0,opt:{},blur:{a:null,b:null},water:[],cand:null,enc:{},npcAt:{},err:null,ready:false,
 nav:null,navKey:'',folk:[],folkId:'',parts:[],tap:null,keys:{},sh:null,chat:0,ff:new Map()};
const dioUIpx=n=>{const c=DIO.cv;if(!c||!c.clientWidth)return n;const k=c.width/c.clientWidth;return Math.round(n*k)};
const DIO_PAD=8,DIO_N=2,DIO_SPEED=3.4;
/* alpha 0.4: what a painting generator yields while the ground painter's helper thread works (paint.js): whatever
   steps it stops for now and comes back later */
const PW_WAIT={pw:1};
const DIO_FX=['butterfly','bird','leaf','smoke','spray','sparkle','bee','fish','moth','flame'];
const DIO_FXM={flame:[12,18,4],butterfly:[8,7,2],bird:[10,6,2],leaf:[5,5,3],smoke:[12,12,4],spray:[6,6,4],sparkle:[7,7,4],print:[6,8,2],bee:[5,4,2],fish:[9,5,2],moth:[7,5,2]};
const DIO_CHAT=['Lovely day for a walk.','Mind the tall grass. Something’s rustling in there.','I heard a Billie tried to buy the sun once.','My grandma walks ten thousand steps before breakfast.',
 'The clinic patches up your team for free, you know.','Have you seen the windmill turn? Very relaxing.','Every step counts, they say. Literally, here.','I’m saving up for a fancy hat.','Watch out, trainers like to battle anyone who looks at them.'];
/* hooks the Studio replaces to show unsaved art and data */
let dioData=()=>({scenes:GD.scenes||{},sc:GD.scenery||{terrains:{},props:{}}});
let dioImg=path=>ART.img[path];
/* v42: exits are kept edge-relative (edgeExits: {id, side N/S/E/W, t along that side 0..1, in metres from the edge, width})
   so a scene can change size and its exits stay on the same edge; sc.exits (the points everything else reads) is
   rebuilt from them whenever the size or the count changes. The Studio keeps both in step while you drag. */
function dioExitPoint(sc,e){const w=sc.w,h=sc.h,n=e.in==null?1.1:e.in,r=v=>Math.round(v*100)/100;return e.side==='N'?[r(e.t*w),r(h-n)]:e.side==='S'?[r(e.t*w),r(n)]:e.side==='E'?[r(w-n),r(e.t*h)]:[r(n),r(e.t*h)]}
function dioExitEdge(sc,p,old){const w=sc.w,h=sc.h,x=p[0],z=p[1],d={W:x,E:w-x,S:z,N:h-z},side=Object.keys(d).sort((a,b)=>d[a]-d[b])[0],t=side==='N'||side==='S'?x/w:z/h;return Object.assign({width:2},old||{},{side,t:+t.toFixed(4),in:+d[side].toFixed(2)})}
function dioExitsSync(sc){const E=sc.edgeExits;if(!E)return sc;const key=sc.w+'x'+sc.h+'/'+E.length;if(sc._exk!==key){sc.exits=E.map(e=>dioExitPoint(sc,e));sc._exk=key}return sc}
/* v43: the scene a view belongs to (a composite's base), for things that go by scene: legends, stamps, ambience */
function dioBaseId(){return (DIO.sc&&DIO.sc.baseId)||DIO.id}
function dioScene(id){if(id&&id.charCodeAt(0)===119&&id[1]===':'&&typeof wrSceneById==='function')return wrSceneById(id);/* v43: a window onto the seamless world */const S=dioData().scenes;return S[id]?dioExitsSync(S[id]):null}
const dioOk=im=>!!(im&&(im.naturalWidth||im.width));
/* a prop's extra layer as a prop of its own: same base point unless it says otherwise, shifted dx right and dy up (pixels),
   dz meters back (negative: in front). Effects, glows, labels and shadows stay with the main picture. */
function dioLayerM(M,l){return {img:l.img,ox:(l.ox??M.ox)+(l.dx||0),oy:(l.oy??M.oy)-(l.dy||0),sway:(M.sway||0)*(l.sway??1),shadow:0,flat:l.face==='flat'?1:0}}
/* the 32 px ground tiles, twelve per kind (art/next/tiles47; the v46 set in art/next/tiles is on the legacy branch) */
/* v47: the 32 px ground is the only full-mode ground (the 16 px tiles stay for Lite mode and the Studio's tile editor) */
const dioNextOn=()=>true;
function dioNextTiles(path,set){const b=(path||'').replace(/^.*\//,'').replace(/\.png$/,'').replace(/_\d+$/,''),f=set||dioTileFolder();return [1,2,3,4,5,6,7,8,9,10,11,12].map(i=>`next/${f}/${b}_${i}.png`)}/* v46: twelve per kind (tools/build-terrain.py) */
/* v47: which set of twelve: the catalogue's tileSet ('tiles47', tools/build-terrain-v47.py), else the v46 set. With the
   v47 set the painter lays the soft patches itself, in world metres, picks the plain tiles evenly and never mirrors */
function dioTileFolder(){const C=typeof dioData==='function'&&dioData();return (C&&C.sc&&C.sc.tileSet)||'tiles47'}
function dioT47(){return dioNextOn()&&dioTileFolder()==='tiles47'}
/* v43: which flag a scene flies: its own (scene/flags/<id>.png) unless it names another */
function dioFlagPath(sc){const D=dioData(),own=sc.baseId||Object.keys(D.scenes).find(k=>D.scenes[k]===sc),id=sc.flag||((D.sc.flags||[]).includes(own)?own:'default');return `scene/flags/${id}.png`}
/* v46: a building's colour variant (p.v = 1..n): the same plan with the variant's picture and colours; the plain
   building (no v, or 0) is the catalogue entry itself, so every placed building looks exactly as before */
const DIO_VAR=new WeakMap();
/* alpha 0.4: a house may wear a green moss roof, solar shingles or chrome instead of its own (p.roof 'moss', 'solar' or
   'chrome', from tools/build-solarpunk.py and build-pearlantis.py): the 3D roof's texture and colour change, the picture stays (its roof is still cut away by
   its own colours) */
const DIO_ROOF={moss:{roofTex:16,roofCol:'#76AA50'},solar:{roofTex:17,roofCol:'#3A4C7E'},chrome:{roofTex:12,roofCol:'#8FC4CE'}};
function dioPropM(p,M){const n=p&&p.v|0,rf=M&&M.build&&p&&p.roof?DIO_ROOF[p.roof]:null;if(!M||!M.build||(!rf&&(!n||!M.build.variants)))return M;
 const V=n&&M.build.variants?M.build.variants[n-1]:null;if(!rf&&(!V||!V.img))return M;
 let c=DIO_VAR.get(M);if(!c)DIO_VAR.set(M,c=new Map());const key=n+'|'+(rf?p.roof:'')+'|'+(typeof bldSigF==='function'?bldSigF(M.build):'');if(c.has(key))return c.get(key);const B=Object.assign({},M.build);delete B.variants;
 if(V&&V.img)for(const k in V)if(k!=='img'&&k!=='extra')B[k]=V[k];if(rf)Object.assign(B,rf);const out=Object.assign({},M,{build:B});if(V&&V.img)out.img=V.img;c.set(key,out);return out}
/* v47: things that are only out at some hours, on some days or in some seasons. A prop may say hours:[from,to]
   (e.g. [6,12]; [21,4] runs past midnight), days:[0-6] (0 is Sunday) and season:'autumn' or a list. The clock is
   the game's (env.js: real time, or the time set in Settings), checked once a second. */
const DIO_CLK={t:-1e9,h:13,day:0,ss:'summer'};
function dioClock(){const n=performance.now();if(n-DIO_CLK.t<1000)return DIO_CLK;DIO_CLK.t=n;const d=new Date();DIO_CLK.h=typeof folkHour==='function'?folkHour():13;DIO_CLK.day=d.getDay();DIO_CLK.ss=typeof envSeason==='function'?envSeason(d):'summer';return DIO_CLK}
/* v47: crops grow between your visits: each field (a prop's "grow", from tools/build-life-v47.py) is sown, grows for
   a week and is harvested, on a nine-day round of its own */
function dioGrowK(p){if(!p||p.grow==null)return 1;const d=new Date(),day=Math.floor((d.getTime()-d.getTimezoneOffset()*6e4)/864e5),st=(day+p.grow*4)%9;return st===0?0:Math.min(1,.3+st*.14)}
function dioPropOn(p){if(!p||!p.hours&&!p.days&&!p.season&&p.grow==null&&!p.dry)return true;if(p.grow!=null&&!dioGrowK(p))return false;
 /* v47: "dry": only while the ground is dry and clear (chalk drawings wash away in the rain and come back after) */
 if(p.dry&&typeof ENV!=='undefined'&&ENV.on&&(ENV.wet>.25||(ENV.sk&&ENV.sk[3]>.3)))return false;if(!p.hours&&!p.days&&!p.season)return true;const T=dioClock();
 if(p.hours){const a=p.hours[0],b=p.hours[1],h=T.h;if(a<=b?!(h>=a&&h<b):!(h>=a||h<b))return false}
 if(p.days&&!p.days.includes(T.day))return false;if(p.season&&!(Array.isArray(p.season)?p.season:[p.season]).includes(T.ss))return false;return true}
function dioTimedKey(sc){let L=sc._timed;if(!L||sc._timedN!==(sc.props||[]).length){L=sc._timed=(sc.props||[]).filter(p=>(p.hours||p.days||p.season)&&!/^fallen|^crops/.test(p.k));sc._timedN=(sc.props||[]).length;sc._tkAt=-1e9}
 /* alpha 0.2: asked hundreds of times a frame (every dioNav); opening hours don't change within a fifth of a second */
 const n=performance.now();if(n-sc._tkAt<200&&sc._tkL===L)return sc._tk;let k='';for(const p of L)k+=dioPropOn(p)?1:0;sc._tk=k;sc._tkAt=n;sc._tkL=L;return k}
/* v47: opening hours: shops and the like close at night (the label says Closed); the clinic, the inn, the station,
   the lab and homes never do */
const OPEN_HOURS={shop:[7,22],bakery:[6,19],market_hall:[7,20],bank:[9,17],library:[9,20],school:[8,17],greenhouse:[7,20],barn:[6,20]};
const OPEN_NAMES={shop:'The shop',bakery:'The bakery',market_hall:'The market hall',bank:'The Savings & Loan',library:'The library',school:'The school',greenhouse:'The greenhouse',barn:'The barn'};
/* v47: the kind a door keeps hours as (not data.js placeKind(id), the kind of a place) */
function openKind(a,p){const C=dioData().sc,M=p&&C.props[p.k],RK=typeof ROOM_KIND!=='undefined'?ROOM_KIND:{};return p&&RK[p.k]?p.k:M&&RK[M.group]?M.group:a}
function placeOpen(kind){const H=OPEN_HOURS[kind];if(!H)return true;const h=dioClock().h;return h>=H[0]&&h<H[1]}
function placeClosedText(kind){const H=OPEN_HOURS[kind],f=v=>`${Math.floor(v)}:${String(Math.round(v%1*60)).padStart(2,'0')}`;return `${OPEN_NAMES[kind]||'It'} is closed for the night. It opens at ${H?f(H[0]):'morning'}.${kind==='shop'?' You can still order from the town card.':''}`}
/* the label over something you can use: what it is, Read for a book you haven't read, Closed after hours */
function dioActLabel(p,M){if(p.label)return p.label;if(p.act==='read')return typeof loreFlags==='function'&&!loreFlags()['read_'+p.book]?'Read':null;if(!(M&&(M.door||M.box)))return null;
 const b={shop:'Shop',clinic:'Clinic',lab:'Lab'}[p.act];if(!b)return null;return placeOpen(openKind(p.act,p))?b:'Closed'}
function dioPaths(sc){const C=dioData().sc,L=new Set([C.wallArt||'scene/build/walls.png','battle/cloud_0.png','battle/cloud_1.png','battle/cloud_2.png',...DIO_FX.map(k=>`scene/fx/${k}.png`)]);
 for(const ch of new Set((sc.tiles||[]).join('')+(sc.edge||'g'))){const T=C.terrains[ch];if(T){L.add(T.tile);for(const v of T.vars||[])L.add(v);if(dioNextOn())for(const q of dioNextTiles(T.tile))L.add(q)}}
 for(const p of sc.props||[]){const P=dioPropM(p,C.props[p.k]);if(P){L.add(P.img);if(typeof DGL_ALT!=='undefined'&&DGL_ALT[p.k])for(const a of DGL_ALT[p.k])if(C.props[a])L.add(C.props[a].img);if(P.blades)L.add(P.blades.img);for(const h of P.hands||[])L.add(h.img);for(const l of P.layers||[])if(l.img)L.add(l.img);if(P.build){const A=C.buildArt||{detail:'scene/build/detail.png',rooms:'scene/build/rooms.png'};L.add(A.detail);L.add(A.rooms)}}}
 for(const [k,P] of Object.entries(C.props))if((P.group||k)==='tallgrass'||k==='tallgrass')L.add(P.img);
 /* v43: the town's flag for its flag poles */
 if((sc.props||[]).some(p=>C.props[p.k]&&C.props[p.k].flag)){L.add(dioFlagPath(sc));L.add('scene/flags/default.png')}
 if(sc.far)L.add(`scene/far/${sc.far}.png`);if(typeof lifePaths==='function')for(const q of lifePaths(sc))L.add(q);if(typeof voxPaths==='function')for(const q of voxPaths(sc,C))L.add(q);return [...L]}
async function dioPrepare(id){const sc=dioScene(id);if(!sc)throw new Error('No scene '+id);await artLoad(dioPaths(sc));try{await dioGroundAsync(sc,-10)}catch(e){console.error(e)}return sc}
/* ---------- ground texture ---------- */
function dioHash(x,y){let h=(x*374761393+y*668265263)^0x5bd1e995;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296}
function dioNoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,s=t=>t*t*(3-2*t),a=dioHash(xi,yi),b=dioHash(xi+1,yi),c=dioHash(xi,yi+1),d=dioHash(xi+1,yi+1);
 return a+(b-a)*s(fx)+(c-a)*s(fy)+(a-b-c+d)*s(fx)*s(fy)}
function dioTilePix(path){let im=dioImg(path);if(!dioOk(im))return null;const w=im.naturalWidth||im.width,h=im.naturalHeight||im.height,c=cnv(w,h),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);
 return {w,h,d:new Uint32Array(x.getImageData(0,0,w,h).data.buffer)}}
function dioGroundKey(sc){const C=dioData().sc;return JSON.stringify([sc.w,sc.h,sc.edge,sc.tiles,dioWearLines(sc).length,(sc.steps||'').length,(sc.stepm||'').length,sc.stepsV||0,0,dioNextOn()?'nx'+dioTileFolder():'',Object.entries(C.terrains).map(([k,t])=>[k,t.tile,t.z,t.edge,t.vars,t.flip,t.paved,t.tone]),typeof dioArtVer==='function'?dioArtVer():0])}
/* The ground picture: every tile drawn from its terrain's picture or one of its variants (picked per tile, the plain
   picture most often), mirrored now and then where the terrain allows it, so big fields don't repeat. Natural ground
   meets its neighbours along a wobbly line; paved ground keeps crisp edges. A higher terrain draws its edge colour onto
   a lower neighbour (curbs, lawn edges). Large soft patches of light, shade and slightly warmer or cooler colour lie on
   top of natural ground. v18: a light lip along the top of every cliff and terrace edge and a shadow along its foot;
   the Lite renderer (no 3D walls) also gets the wall faces painted below each edge.
   v18 also builds it a slice at a time (dioGroundAsync) so opening a scene never freezes the game, with the noise
   sampled on a coarse grid (several times faster), and keeps the last few scenes' pictures for instant revisits. */
/* v46: which ground pattern each cell takes. Inside a scene its own metres, on a road the road's frame, so a spot
   looks the same in every view it appears in (sc.stable, set by world.js); a plain scene uses its own metres. */
function dioStableCells(sc,cx0,cy0,cw,ch){const P=DIO_PAD,H=sc.h,S=sc.stable,ox=new Int32Array(cw*ch),oz=new Int32Array(cw*ch),salt=new Int32Array(cw*ch);
 for(let j=0;j<ch;j++)for(let i=0;i<cw;i++){const x=cx0+i-P,z=H-1-(cy0+j-P),q=j*cw+i;if(!S)continue;let hit=false;
  for(const r of S.scenes){const k=r.clip;if(k?(x>=k[0]&&z>=k[1]&&x<k[2]&&z<k[3]):(x>=r.x&&z>=r.z&&x<r.x+r.w&&z<r.z+r.h)){ox[q]=-r.x;oz[q]=-r.z;salt[q]=r.salt|0;hit=true;break}}
  if(hit)continue;if(!S.roads.length){/* alpha 0.2: the countryside round a joined view takes the nearest place's metres */let b=null;for(const r of S.scenes){const k=r.clip||[r.x,r.z,r.x+r.w,r.z+r.h],d=Math.hypot(x+.5-clamp(x+.5,k[0],k[2]),z+.5-clamp(z+.5,k[1],k[3]));if(!b||d<b.d)b={d,r}}if(b){ox[q]=-b.r.x;oz[q]=-b.r.z;salt[q]=b.r.salt|0}continue}let best=null;for(const r of S.roads){const n=wrNear(r.R,x+.5-r.o[0],z+.5-r.o[1]);if(!best||n.d<best.d)best={d:n.d,r}}ox[q]=-best.r.o[0];oz[q]=-best.r.o[1];salt[q]=best.r.salt|0}
 return {ox,oz,salt}}
/* v46: worn ground: within about 0.7 m of the straight lines from a scene's hub to each of its exits, wobbling a
   little, natural ground shows its trodden tiles. Each scene's lines are in its own metres (sc.stable), so every view
   of it wears the same. (x, z) are view metres; (sx, sz) the cell's stable metres */
function dioWearLines(sc){const S=sc.stable,L=[];const add=(hub,exits,ox,oz,worn,clip)=>{const put=(a,b,c,d)=>{if(!clip){L.push([a,b,c,d]);return}const s=dioClipSeg(a,b,c,d,clip);if(s)L.push(s)};if(hub)for(const e of exits||[])put(hub[0]+ox,hub[1]+oz,e[0]+ox,e[1]+oz);
  /* v47: the shortcuts people take across the grass (tools/build-life-v47.py) */for(const w of worn||[])put(w[0]+ox,w[1]+oz,w[2]+ox,w[3]+oz)};
 if(S){for(const r of S.scenes)add(r.hub,r.exits,r.x,r.z,r.worn,r.clip)}else add(sc.hub||null,sc.exits,0,0,sc.worn);return L}
/* the part of segment (x0, z0)-(x1, z1) inside rect k = [x0, z0, x1, z1], or null */
function dioClipSeg(x0,z0,x1,z1,k){let t0=0,t1=1;const dx=x1-x0,dz=z1-z0;for(const [p,q] of [[-dx,x0-k[0]],[dx,k[2]-x0],[-dz,z0-k[1]],[dz,k[3]-z0]]){if(p===0){if(q<0)return null;continue}const r=q/p;if(p<0){if(r>t1)return null;if(r>t0)t0=r}else{if(r<t0)return null;if(r<t1)t1=r}}return [x0+dx*t0,z0+dz*t0,x0+dx*t1,z0+dz*t1]}
/* v47: how worn the ground is at (x, z) (view metres; sx, sz its stable metres): 1 along the middle of a line people
   walk, fading to 0 at its edge, about 0.45 to 0.95 m out (the same reach as the worn tiles) */
function dioWearAmtFn(sc){const L=dioWearLines(sc);if(!L.length)return null;
 /* v47b: the lines as a flat table with their boxes (1 m round each), and nothing further than a metre worked out */
 const n=L.length,F=new Float64Array(n*9);L.forEach(([ax,az,bx,bz],i)=>{const vx=bx-ax,vz=bz-az;F.set([ax,az,vx,vz,vx*vx+vz*vz||1,Math.min(ax,bx)-1,Math.max(ax,bx)+1,Math.min(az,bz)-1,Math.max(az,bz)+1],i*9)});
 return (x,z,sx,sz)=>{let d=1;for(let i=0;i<n;i++){const o=i*9;if(x<F[o+5]||x>F[o+6]||z<F[o+7]||z>F[o+8])continue;const ax=F[o],az=F[o+1],vx=F[o+2],vz=F[o+3];let t=((x-ax)*vx+(z-az)*vz)/F[o+4];t=t<0?0:t>1?1:t;const ex=ax+vx*t-x,ez=az+vz*t-z,e=Math.sqrt(ex*ex+ez*ez);if(e<d)d=e}
  if(d>=.95)return 0;const r=.45+.5*dioNoise(sx*.4+3,sz*.4);if(d>=r)return 0;const q=Math.min(1,(r-d)/(r*.65));return q*q*(3-2*q)}}
function dioWearFn(sc,wx0,wy0){const L=dioWearLines(sc);if(!L.length)return ()=>false;
 return (x,z,sx,sz)=>{for(const [ax,az,bx,bz] of L){const vx=bx-ax,vz=bz-az,l2=vx*vx+vz*vz||1,t=Math.max(0,Math.min(1,((x-ax)*vx+(z-az)*vz)/l2)),d=Math.hypot(ax+vx*t-x,az+vz*t-z);if(d<.45+.5*dioNoise(sx*.4+3,sz*.4))return true}return false}}
/* v47: the soft patches of light and shade, laid across the whole ground in world metres (in the v46 tiles they were
   cut at every tile's edge and repeated with the tile): a quarter of natural ground half a step darker and a touch
   richer, a fifth lighter and a touch paler, a checker where they meet. A kind's `tone` scales them (paved: none).
   The same sums as tools/build-terrain-v47.py (tone_at, tone_px), so its sheets show what the game lays */
const DIO_TC=[Math.cos(.52),Math.sin(.52),Math.cos(-.35),Math.sin(-.35)],DIO_TD=[.895,.905,.935],DIO_TL=[1.05,1.05,1.04],DIO_TA=[5,4,1],DIO_T0=[0,0,0];
function dioToneAt(x,z){const C=DIO_TC,u=x*C[0]-z*C[1],w=x*C[1]+z*C[0],u2=x*C[2]-z*C[3],w2=x*C[3]+z*C[2];return .62*dioNoise(u*3.1,w*3.1)+.38*dioNoise(u2*6.3+17.3,w2*6.3+4.1)}
function dioTonePx(c,v,odd,k){const dark=v<.372||(v<.408&&!odd);if(!dark&&!(v>.653||(v>.617&&!odd)))return c;
 /* (written out without a small function per pixel: this runs for about half the natural ground) */
 const r=c&255,g=(c>>8)&255,b=(c>>16)&255,l=.3*r+.59*g+.11*b,s=dark?1.12:.92,F=dark?DIO_TD:DIO_TL,A=dark?DIO_T0:DIO_TA;
 let yr=r+((l+(r-l)*s)*F[0]+A[0]-r)*k,yg=g+((l+(g-l)*s)*F[1]+A[1]-g)*k,yb=b+((l+(b-l)*s)*F[2]+A[2]-b)*k;yr=yr<0?0:yr>255?255:yr|0;yg=yg<0?0:yg>255?255:yg|0;yb=yb<0?0:yb>255?255:yb|0;
 return (c&0xff000000)|(yb<<16)|(yg<<8)|yr}
/* v47: the plain tile of a metre: the three equally often, and not the one the metre to the left or behind would pick
   on its own (two of the same side by side showed as a repeat) */
/* v47: a scene's mood: its own (sc.mood), else its place's (route entry .mood); the presets are in the data (moods) */
function dioMoodOf(S){if(!S)return null;if(S.mood)return S.mood;const R=(typeof GD!=='undefined'&&GD.route||[]).find(r=>r.id===S.place);return R&&R.mood||null}
function dioShade(c,k){return (c&0xff000000)|(Math.min(255,((c>>16)&255)*k)<<16)|(Math.min(255,((c>>8)&255)*k)<<8)|Math.min(255,(c&255)*k)}
function dioPlain47(sx,sz,sa){const h=(x,z)=>Math.floor(dioHash(x*3+11+sa*7919,z*7+5)*3),p=h(sx,sz),L=h(sx-1,sz),U=h(sx,sz-1);for(let k=0;k<3;k++){const c=(p+k)%3;if(c!==L&&c!==U)return [0,6,7][c]}return [0,6,7][p]}
/* v46: tile pictures at a smaller size (each f x f block averaged), for a view's distant ground */
function dioTileScale(t,f){if(!t||f<=1)return t;const w=Math.max(1,t.w/f|0),h=Math.max(1,t.h/f|0),d=new Uint32Array(w*h),n=f*f;for(let y=0;y<h;y++)for(let x=0;x<w;x++){let r=0,g=0,b=0;for(let c=0;c<f;c++)for(let a=0;a<f;a++){const v=t.d[(y*f+c)*t.w+x*f+a];r+=v&255;g+=(v>>8)&255;b+=(v>>16)&255}d[y*w+x]=0xff000000|((b/n|0)<<16)|((g/n|0)<<8)|(r/n|0)}return {w,h,d}}
const DIO_TILECACHE=new Map();
function dioTileSet(T,TP){const C=dioData().sc,nxOn=dioNextOn(),key=TP+'|'+(nxOn?dioTileFolder():0)+'|'+T.tile+'|'+(T.vars||[]).join(',')+'|'+(typeof dioArtVer==='function'?dioArtVer():0);let L=DIO_TILECACHE.get(key);if(L)return L;
 if(nxOn){const src=dioNextTiles(T.tile).map(q=>dioTilePix(q)).filter(Boolean);if(src.length)L=src.map(t=>dioTileScale(t,Math.round(t.w/TP)))}
 if(!L){const src=[dioTilePix(T.tile),...(T.vars||[]).map(q=>dioTilePix(q))].filter(Boolean),bw=C.tile||16;L=src.length?src.map(t=>TP>=t.w?t:dioTileScale(t,Math.round(t.w/TP))):[null]}
 if(L.every(Boolean))DIO_TILECACHE.set(key,L);return L}
/* The ground picture: every tile drawn from its terrain's picture or one of its variants (picked per tile, the plain
   picture most often), mirrored now and then where the terrain allows it, so big fields don't repeat. Natural ground
   meets its neighbours along a wobbly line; paved ground keeps crisp edges. A higher terrain draws its edge colour onto
   a lower neighbour (curbs, lawn edges). Large soft patches of light, shade and slightly warmer or cooler colour lie on
   top of natural ground. v18: a light lip along the top of every cliff and terrace edge and a shadow along its foot;
   the Lite renderer (no 3D walls) also gets the wall faces painted below each edge.
   v46: any rectangle of the scene's picture (canvas cells, padding included; row 0 the far edge) at any size: TP pixels
   a metre. The 3D renderer paints a view's whole ground small (its distance) and the 16 m squares round you at full
   size (diorama-gl.js, the near ring). Patterns and noise come from each cell's own scene or road metres. */
function* dioPaintGen(sc,o){const C=dioData().sc,W=sc.w,H=sc.h,P=DIO_PAD,TP=o.TP,rows=sc.tiles||[],CWf=W+2*P,CHf=H+2*P;
 const R0=o.rect||[0,0,CWf,CHf],M=o.margin??2,Mp=Math.min(1,M),wx0=R0[0]-M,wy0=R0[1]-M,ww=R0[2]+2*M,wh=R0[3]+2*M,PXO=(M-Mp)*TP,TW=(R0[2]+2*Mp)*TP,TH=(R0[3]+2*Mp)*TP,THf=CHf*TP;/* v46: cells with a margin of M (the edge wobble reaches 1.6 m), pixels with a margin of Mp (the relief blur and edges need less) */
 const chars=Object.keys(C.terrains),idx=Object.fromEntries(chars.map((c,i)=>[c,i])),T=chars.map(c=>C.terrains[c]),edge=T.map(t=>pkh(t.edge||'#000000')),zz=T.map(t=>t.z||0);
 /* v47: tile sets only for the kinds this rectangle shows (78 kinds now: decoding all of them held up the first paint of a place) */
 const used=new Uint8Array(T.length);used[idx[sc.edge]??0]=1;for(let gy=wy0;gy<wy0+wh;gy++){const j=gy-P,row=j>=0&&j<H?rows[j]||'':null;for(let gx=wx0;gx<wx0+ww;gx++){const i=gx-P;if(row==null||i<0||i>=W){used[idx[sc.edge]??0]=1;continue}const k=idx[row[i]];used[k==null?(idx[sc.edge]??0):k]=1}}
 /* alpha 0.4: paving that breaks where it meets natural ground (a kind's `break` in the data: 'stones' stone by stone,
    'crumble' pixel by pixel for asphalt and concrete); the soil that shows round it is the Dirt kind's */
 const brk=T.map(t=>TP>=8?(t.break==='stones'?1:t.break==='crumble'?2:0):0),brkOn=brk.some((b,i)=>b&&used[i]),soilK=brkOn?idx.u:null;if(soilK!=null)used[soilK]=1;
 const pix=T.map((t,i)=>used[i]?dioTileSet(t,TP):[]),pav=T.map((t,i)=>t.paved!=null?!!t.paved:'mbaqhe'.includes(chars[i])),t47=dioT47(),flip=T.map(t=>!!t.flip&&!t47);
 const toneK=T.map((t,i)=>t47&&TP>=16&&pix[i].length>=12?(t.tone!=null?+t.tone:pav[i]?0:1):0),toneOn=toneK.some(k=>k>0);
 const lumK=pix.map(L=>{const t=L&&L[0];if(!t)return 128;let s=0;for(let j=0;j<t.d.length;j+=7){const c=t.d[j];s+=(c&255)*.3+((c>>8)&255)*.59+((c>>16)&255)*.11}return s/Math.ceil(t.d.length/7)});
 const eI=idx[sc.edge]??0,cellAt=(i,j)=>{if(i<0||j<0||i>=W||j>=H)return eI;const ch=(rows[j]||'')[i];const k=idx[ch];return k==null?eI:k};
 const CW=ww,CH=wh,pick=new Uint8Array(CW*CH),fl=new Uint8Array(CW*CH),cellK=new Uint8Array(CW*CH),ST=dioStableCells(sc,wx0,wy0,CW,CH);
 /* v46: with twelve tiles a kind, each has a role: plain ones (0, 6, 7) over most of the ground, the touched ones
    (1-5, 8, 9) gathered in slow patches of detail, the worn ones (10, 11) along the lines people walk */
 const DET=[1,2,3,4,5,8,9],wornAt=dioWearFn(sc,wx0,wy0);
 /* alpha 0.4: the cells on such an edge, one bit per neighbour across it (left, right, up, down, then the corners):
    breaking paving with natural ground beside it, or natural ground beside breaking paving */
 const ND=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];let PB=null;
 for(let cj=0;cj<CH;cj++)for(let ci=0;ci<CW;ci++){const q=cj*CW+ci,gx=wx0+ci,gy=wy0+cj,k=cellAt(gx-P,gy-P),n=pix[k].length,sx=gx-P+ST.ox[q],sz=H-1-(gy-P)+ST.oz[q],sa=ST.salt[q],r=dioHash(sx*3+11+sa*7919,sz*7+5);cellK[q]=k;
  if(n>=12){const det=dioNoise(sx/4.7+sa*.013,sz/4.7+31),wr=!pav[k]&&wornAt(gx-P+.5,H-(gy-P)-.5,sx,sz);pick[q]=wr?(r<.5?10:11):det>.63?DET[Math.floor(r*7)]:t47?dioPlain47(sx,sz,sa):(r<.5?0:r<.75?6:7)}
  else pick[q]=n>1&&r>.4?1+Math.min(n-2,Math.floor((r-.4)/.6*(n-1))):0;fl[q]=flip[k]?Math.floor(dioHash(sx+71+sa*104729,sz+13)*4):0}
 if(brkOn){PB=new Uint8Array(CW*CH);for(let cj=0;cj<CH;cj++)for(let ci=0;ci<CW;ci++){const q=cj*CW+ci,k=cellK[q];if(pav[k]&&!brk[k])continue;let m=0;
  for(let n=0;n<8;n++){const ii=ci+ND[n][0],jj=cj+ND[n][1];if(ii<0||jj<0||ii>=CW||jj>=CH)continue;const kk=cellK[jj*CW+ii];if(brk[k]?!pav[kk]:brk[kk])m|=1<<n}PB[q]=m}}
 /* stable metres of a work pixel (u, v): its cell's offsets */
 const cellOf=(u,v)=>{let cy=Math.floor((v+PXO)/TP),cx=Math.floor((u+PXO)/TP);cy=cy<0?0:cy>=CH?CH-1:cy;cx=cx<0?0:cx>=CW?CW-1:cx;return cy*CW+cx},xsOf=(u,q)=>(wx0*TP+PXO+u)/TP-P+ST.ox[q],zsOf=(v,q)=>H+P-(wy0*TP+PXO+v)/TP+ST.oz[q];
 /* the wobble of natural edges, on a 2-pixel grid; light, shade and warmth on an 8-pixel grid (TP/4 at small sizes) */
 const JW=(TW>>1)+2,JH=(TH>>1)+2,JX=new Float32Array(JW*JH),JY=new Float32Array(JW*JH);
 /* v47b: light and shade and the worn track on a 4-pixel grid (a quarter of the sums; both are smooth at that scale) */
 const KW=(TW>>2)+2,KH=(TH>>2)+2,TN=toneOn?new Float32Array(KW*KH):null;
 const wearAmt=toneOn?dioWearAmtFn(sc):null,WV=wearAmt?new Float32Array(KW*KH):null,wear=T.map((t,i)=>toneK[i]>0&&t.wear?(t.wear==='pack'?-1:pkh(t.wear)):0);
 const keyOf=q=>ST.ox[q]*65536+ST.oz[q],cOf=(u,v)=>{let cy=Math.floor((v+PXO)/TP),cx=Math.floor((u+PXO)/TP);return [cx<0?0:cx>=CW?CW-1:cx,cy<0?0:cy>=CH?CH-1:cy]};
 let oneKey=true;{const k0=keyOf(0);for(let q=1;q<CW*CH&&oneKey;q++)if(keyOf(q)!==k0)oneKey=false}/* v47b: a plain scene has one set of metres: no seams to blend */
 const toneField=(u,v,q,xs,zs)=>{if(oneKey)return dioToneAt(xs,zs);const k0=keyOf(q),[cx,cy]=cOf(u,v);let acc=0,wt=0;
  for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]])for(let s=1;s<=2;s++){const ix=cx+a*s,iy=cy+b*s;if(ix<0||iy<0||ix>=CW||iy>=CH)break;const qq=iy*CW+ix;if(keyOf(qq)===k0)continue;
   const e=a>0?ix*TP-PXO-u:a<0?u-((ix+1)*TP-PXO):b>0?iy*TP-PXO-v:v-((iy+1)*TP-PXO),w=.5*Math.max(0,1-e/TP/2);if(w>0){acc+=w*dioToneAt(xsOf(u,qq),-zsOf(v,qq));wt+=w}break}
  const t0=dioToneAt(xs,zs);if(!wt)return t0;const W=Math.min(.5,wt);return t0*(1-W)+acc/wt*W};
 if(TN||WV)for(let y=0;y<KH;y++){for(let x=0;x<KW;x++){const u=x*4,v=y*4,q=cellOf(u,v),xs=xsOf(u,q),zs=-zsOf(v,q);if(TN)TN[y*KW+x]=toneField(u,v,q,xs,zs);if(WV)WV[y*KW+x]=wearAmt((wx0*TP+PXO+u)/TP-P,H-((wy0*TP+PXO+v)/TP-P),xs,-zs)}if(y%32===31)yield}
 for(let y=0;y<JH;y++){for(let x=0;x<JW;x++){const u=x*2,v=y*2,q=cellOf(u,v),xs=xsOf(u,q),zs=-zsOf(v,q);const fr=(dioHash(Math.round(xs*16),Math.round(zs*16))-.5)*.3,fr2=(dioHash(Math.round(xs*16)+7,Math.round(zs*16)+3)-.5)*.3;/* v46: a speckled fringe about 0.3 m wide where two kinds of ground meet */JX[y*JW+x]=(dioNoise(xs*1.2,zs*1.2)-.5)*1.15+(dioNoise(xs*4.4+5.1,zs*4.4)-.5)*.4+fr;JY[y*JW+x]=(dioNoise(xs*1.2+31.7,zs*1.2+11.3)-.5)*1.15+(dioNoise(xs*4.4+17,zs*4.4+3)-.5)*.4+fr2}if(y%64===63)yield}
 const G=Math.max(2,Math.min(8,TP>>2)),MW=Math.ceil(TW/G)+2,MH=Math.ceil(TH/G)+2,MF=new Float32Array(MW*MH),MU=new Float32Array(MW*MH);
 const mfAt=(xs,zs)=>dioNoise(xs/3.1,zs/3.1)*.6+dioNoise(xs/1.3+9,zs/1.3+4)*.4,muAt=(xs,zs)=>(dioNoise(xs/7.3+40,zs/7.3+17)-.5)*.16;
 for(let y=0;y<MH;y++){for(let x=0;x<MW;x++){const u=x*G,v=y*G,q=cellOf(u,v);
   /* where scene and road meet, the soft patches are blended from both sides' metres, so there is no line */
   let f=0,hu=0,n=0;const seen=[];for(const [a,b] of [[0,0],[-TP*2,0],[TP*2,0],[0,-TP*2],[0,TP*2]]){const qq=cellOf(u+a,v+b),key=ST.ox[qq]*65536+ST.oz[qq];if(a||b){if(key===ST.ox[q]*65536+ST.oz[q]||seen.includes(key))continue}seen.push(key);const xs=xsOf(u,qq),zs=-zsOf(v,qq);f+=mfAt(xs,zs);hu+=muAt(xs,zs);n++}
   MF[y*MW+x]=f/n;MU[y*MW+x]=hu/n}if(y%64===63)yield}
 const bil=(A,u,v)=>{const fx=u/G,fy=v/G,x0=fx|0,y0=fy|0,tx=fx-x0,ty=fy-y0,i=y0*MW+x0;return (A[i]*(1-tx)+A[i+1]*tx)*(1-ty)+(A[i+MW]*(1-tx)+A[i+MW+1]*tx)*ty};
 const UC=new Int32Array(TW);for(let u=0;u<TW;u++)UC[u]=Math.floor((u+PXO)/TP);
 yield;
 const map=new Uint8Array(TW*TH),cel=new Int32Array(TW*TH),out=new Uint32Array(TW*TH);
 /* alpha 0.4: the band along a breaking edge (half a metre each side): which pixels, how far in each lies (+ a slow
    wobble), which neighbour cell is across, and whether the paving's own picture has a stone there (brighter) or a joint */
 let BN=0,BI=null,BS=null,BB=null,BT=null;const EB=PB?new Uint8Array(TW*TH):null,EN=PB?new Uint8Array(TW*TH):null;
 if(PB){const cap=Math.max(1024,TW*TH>>3);BI=new Int32Array(cap);BS=new Float32Array(cap);BB=new Uint8Array(cap);BT=new Uint8Array(cap)}
 const bandPush=(i,sv,nb,st)=>{if(BN>=BI.length){const g=(A,T)=>{const b=new T(A.length*2);b.set(A);return b};BI=g(BI,Int32Array);BS=g(BS,Float32Array);BB=g(BB,Uint8Array);BT=g(BT,Uint8Array)}BI[BN]=i;BS[BN]=sv;BB[BN]=nb;BT[BN]=st;BN++};
 for(let v=0;v<TH;v++){const jy=(v>>1)*JW,vf=(v+PXO)/TP,cj0=Math.floor(vf);for(let u=0;u<TW;u++){const ji=jy+(u>>1),nx=JX[ji],ny=JY[ji];
  const ci0=UC[u],k0=cellK[cj0*CW+ci0];let ci1=Math.floor((u+PXO)/TP+nx),cj1=Math.floor(vf+ny);ci1=ci1<0?0:ci1>=CW?CW-1:ci1;cj1=cj1<0?0:cj1>=CH?CH-1:cj1;const c1=cj1*CW+ci1,k1=cellK[c1];
  const useJ=!pav[k0]&&!pav[k1];map[v*TW+u]=useJ?k1:k0;cel[v*TW+u]=useJ?c1:cj0*CW+ci0;
  if(PB){const q0=cj0*CW+ci0,m=PB[q0];if(m){const fx=(u+.5+PXO)/TP-ci0,fy=(v+.5+PXO)/TP-cj0;let d=9,nb=-1;
    if(m&1&&fx<d){d=fx;nb=0}if(m&2&&1-fx<d){d=1-fx;nb=1}if(m&4&&fy<d){d=fy;nb=2}if(m&8&&1-fy<d){d=1-fy;nb=3}
    if(m&16){const e=Math.hypot(fx,fy);if(e<d){d=e;nb=4}}if(m&32){const e=Math.hypot(1-fx,fy);if(e<d){d=e;nb=5}}if(m&64){const e=Math.hypot(fx,1-fy);if(e<d){d=e;nb=6}}if(m&128){const e=Math.hypot(1-fx,1-fy);if(e<d){d=e;nb=7}}
    if(d<.5){const qn=(cj0+ND[nb][1])*CW+ci0+ND[nb][0],kO=cellK[q0],ownP=!!brk[kO],kp=ownP?kO:cellK[qn],cp=ownP?q0:qn;
     const L=pix[kp],tp=L[Math.min(L.length-1,pick[cp])]||L[0];let st=0;if(tp){const f=fl[cp];let x=u%tp.w,y=v%tp.h;if(f&1)x=tp.w-1-x;if(f&2)y=tp.h-1-y;const cc=tp.d[y*tp.w+x];st=(cc&255)*.3+((cc>>8)&255)*.59+((cc>>16)&255)*.11>lumK[kp]*.97?1:0}
     const xs=xsOf(u,q0),zs=zsOf(v,q0),sv=(ownP?d:-d)+(dioNoise(xs*2.6+7.7,zs*2.6+1.3)-.5)*.36+(dioNoise(xs*6.1,zs*6.1+5)-.5)*(brk[kp]===2?.22:.1);bandPush(v*TW+u,sv,nb,st)}}}}if(v%48===47)yield}
 /* alpha 0.4: stone by stone. In the band, the paving's stones (its brighter pixels, joined up) each stay or go as a
    whole, by the average of their pixels' (distance in + wobble); the joints between the outer stones open to the
    ground beside. Asphalt and concrete ('crumble') go pixel by pixel. What stays, and how far from the edge every
    band pixel is, is kept for the colours below (soil round the stones, grass in the outer joints) */
 if(BN){const slot=new Int32Array(TW*TH).fill(-1);for(let b=0;b<BN;b++)slot[BI[b]]=b;const keep=new Uint8Array(BN),seen=new Uint8Array(BN),Qb=new Int32Array(BN);
  const kpOf=b=>{const i=BI[b],u=i%TW,v=(i-u)/TW,q0=Math.floor((v+PXO)/TP)*CW+UC[u],kO=cellK[q0];return brk[kO]?kO:cellK[q0+ND[BB[b]][1]*CW+ND[BB[b]][0]]};
  for(let b=0;b<BN;b++){if(seen[b])continue;const kp=kpOf(b);if(brk[kp]!==1||!BT[b]){seen[b]=1;keep[b]=BS[b]>(BT[b]||brk[kp]===2?0:.08)?1:0;continue}
   let h=0,t=0,n=0;Qb[t++]=b;seen[b]=1;while(h<t){const c=Qb[h++],i=BI[c];n++;for(const o of [1,-1,TW,-TW]){const j=i+o;if(j<0||j>=TW*TH||(o===1&&j%TW===0)||(o===-1&&i%TW===0))continue;const e=slot[j];if(e<0||seen[e]||!BT[e])continue;seen[e]=1;Qb[t++]=e}}
   let sum=0,mi=BI[Qb[0]];for(let a=0;a<t;a++){sum+=BS[Qb[a]];if(BI[Qb[a]]<mi)mi=BI[Qb[a]]}const mu=mi%TW,mv=(mi-mu)/TW,q0=Math.floor((mv+PXO)/TP)*CW+UC[mu],rk=dioHash(Math.round(xsOf(mu,q0)*TP)*7+5,Math.round(zsOf(mv,q0)*TP)*3+11);
   const k=sum/t+(rk-.5)*.34>0?1:0;for(let a=0;a<t;a++)keep[Qb[a]]=k}
  for(let b=0;b<BN;b++){const i=BI[b],u=i%TW,v=(i-u)/TW,q0=Math.floor((v+PXO)/TP)*CW+UC[u],kO=cellK[q0],ownP=!!brk[kO],qn=q0+ND[BB[b]][1]*CW+ND[BB[b]][0],kp=ownP?kO:cellK[qn],kn=ownP?cellK[qn]:kO;
   if(keep[b]){map[i]=kp;cel[i]=ownP?q0:qn}else if(ownP){map[i]=kn;cel[i]=qn}EB[i]=Math.max(1,Math.min(255,128+BS[b]*254|0));EN[i]=kn|(ownP?128:0)}
  /* how near each natural pixel of the band is to paving that stayed (in pixels, up to 6): the soil fringe below */
  const R=Math.max(2,Math.round(TP*.14));for(let b=0;b<BN;b++){const i=BI[b];if(keep[b]||pav[map[i]])continue;let best=R+1;const u=i%TW,v=(i-u)/TW;
   for(let dy=-R;dy<=R&&best>1;dy++){const y=v+dy;if(y<0||y>=TH)continue;for(let dx=-R;dx<=R;dx++){const x=u+dx;if(x<0||x>=TW)continue;const j=y*TW+x;if(pav[map[j]]&&brk[map[j]]){const e=Math.abs(dx)+Math.abs(dy);if(e<best)best=e}}}
   if(best<=R)EB[i]=Math.max(1,Math.min(127,Math.round(128-best*(127/(R+1)))));else EB[i]=1}}
 yield
 /* v47: painted edges. A kind that grows over its neighbours (catalogue `grow`: plant cover, snow, leaf litter) reaches
    a few pixels onto the ground beside it: blades over a path's edge, moss in the joints of paving, snow drifting
    onto rock, leaves strewn on the road. dG: how far each pixel is from the nearest such pixel; sG: which kind */
 const GRW=T.map(t=>t47&&TP>=16?({plant:1,snow:2,litter:3})[t.grow]||0:0),wet=T.map((t,i)=>'wd'.includes(chars[i]));let dG=null,sG=null;
 if(GRW.some(Boolean)){dG=new Uint8Array(TW*TH).fill(255);sG=new Uint8Array(TW*TH);
  for(let i=0;i<TW*TH;i++)if(GRW[map[i]]){dG[i]=0;sG[i]=map[i]}
  for(let v=0;v<TH;v++)for(let u=0;u<TW;u++){const i=v*TW+u;if(!dG[i])continue;let d=dG[i];if(u>0&&dG[i-1]+1<d){d=dG[i-1]+1;sG[i]=sG[i-1]}if(v>0&&dG[i-TW]+1<d){d=dG[i-TW]+1;sG[i]=sG[i-TW]}dG[i]=d>255?255:d}
  for(let v=TH-1;v>=0;v--)for(let u=TW-1;u>=0;u--){const i=v*TW+u;if(!dG[i])continue;let d=dG[i];if(u<TW-1&&dG[i+1]+1<d){d=dG[i+1]+1;sG[i]=sG[i+1]}if(v<TH-1&&dG[i+TW]+1<d){d=dG[i+TW]+1;sG[i]=sG[i+TW]}dG[i]=d>255?255:d}
  yield}
 const EDGE_P=[0,.6,.42,.27,.15,.07,.03];
 for(let v=0;v<TH;v++){for(let u=0;u<TW;u++){const i=v*TW+u,k=map[i],c0=cel[i],L=pix[k],tp=L[Math.min(L.length-1,pick[c0])]||L[0];let c=0xff808080;
  if(tp){const f=fl[c0];let x=u%tp.w,y=v%tp.h;if(f&1)x=tp.w-1-x;if(f&2)y=tp.h-1-y;c=tp.d[y*tp.w+x]}
  let eb=0;if(EB&&EB[i]){eb=EB[i];const kn=EN[i]&127,bed=EN[i]>127,q=c0,X=wx0*TP+PXO+u+ST.ox[q]*TP,Y=wy0*TP+PXO+v-ST.oz[q]*TP,h=dioHash(X*5+3,Y*3+17),gw=T[kn].grow,wetN='wd'.includes(chars[kn]),plant=gw==='plant'||gw==='litter';
   const soil=()=>{const S=soilK!=null&&pix[soilK][0];if(!S)return dioShade(c,.78);const sp=S.d[(v%S.h)*S.w+(u%S.w)],m=.5;/* half soil, half the ground it is in, a little dark */
    return dioShade(0xff000000|(((((sp>>16)&255)*m+((c>>16)&255)*(1-m))|0)<<16)|(((((sp>>8)&255)*m+((c>>8)&255)*(1-m))|0)<<8)|(((sp&255)*m+(c&255)*(1-m))|0),.8+.12*dioHash(X+1,Y+2))};
   if(!pav[k]){if(wetN){}
    /* where a stone is missing: its bed, packed soil with a tuft or two */else if(bed){if(!plant||h<.62)c=soil()}
    /* round the stones that stayed: a little shade, now and then a speck of soil */else if(eb>1&&eb<128){const a=(eb-1)/126;c=dioShade(c,1-.12*a);if(plant&&h<a*.3)c=soil()}}
   else{const sv=(eb-128)/254;if(sv<.2&&!wetN){const l=(c&255)*.3+((c>>8)&255)*.59+((c>>16)&255)*.11;if(l<lumK[k]*.92&&h<(1-sv/.2)*.85){const N=pix[kn][Math.min(pix[kn].length-1,pick[c0])]||pix[kn][0];if(N){const sp=N.d[(v%N.h)*N.w+(u%N.w)];c=dioShade(sp,gw==='plant'?.84:.9)}}}}}
  let hz=zz[k],hi=-1;if(u>0&&zz[map[i-1]]>hz){hz=zz[map[i-1]];hi=map[i-1]}if(u<TW-1&&zz[map[i+1]]>hz){hz=zz[map[i+1]];hi=map[i+1]}if(v>0&&zz[map[i-TW]]>hz){hz=zz[map[i-TW]];hi=map[i-TW]}if(v<TH-1&&zz[map[i+TW]]>hz){hz=zz[map[i+TW]];hi=map[i+TW]}
  if(hi>=0&&!eb)c=edge[hi];
  else if(TN&&toneK[k]>0){const x0=u>>2,y0=v>>2,tx=(u&3)*.25,ty=(v&3)*.25,j=y0*KW+x0,tv=(TN[j]*(1-tx)+TN[j+1]*tx)*(1-ty)+(TN[j+KW]*(1-tx)+TN[j+KW+1]*tx)*ty,odd=(u+v)&1;
   if(tv<.408||tv>.617)c=dioTonePx(c,tv,odd,toneK[k]);/* (the light and dark bands; most of the ground is between) */
   /* v47: the worn track: bare soil in patches (plants) or packed and paler (earth), most along the middle of the line */
   if(WV&&wear[k]&&(WV[j]>0||WV[j+1]>0||WV[j+KW]>0||WV[j+KW+1]>0)){const wv=(WV[j]*(1-tx)+WV[j+1]*tx)*(1-ty)+(WV[j+KW]*(1-tx)+WV[j+KW+1]*tx)*ty;if(wv>.04){const bald=tv>.9-.33*wv,thin=!bald&&tv>.9-.4*wv&&((u+v)&1);
    if(wear[k]===-1){if(bald||thin){const kk=bald?.32:.16,r=c&255,g=(c>>8)&255,b=(c>>16)&255;c=(c&0xff000000)|(Math.min(255,b+(235-b)*kk*.8)<<16)|(Math.min(255,g+(232-g)*kk)<<8)|Math.min(255,r+(236-r)*kk)}}
    else if(bald||thin){const S=wear[k],m=bald&&tv>.97-.33*wv?1.12:1;const sr=Math.min(255,(S&255)*m),sg=Math.min(255,((S>>8)&255)*m),sb=Math.min(255,((S>>16)&255)*m),r=c&255,g=(c>>8)&255,b=(c>>16)&255,a=bald?1:.5;
     c=(c&0xff000000)|((b+(sb-b)*a)<<16)|((g+(sg-g)*a)<<8)|(r+(sr-r)*a)}}}}
  if(dG&&dG[i]>0&&dG[i]<7&&!GRW[k]&&!wet[k]){const S=sG[i],g=GRW[S],d=dG[i],q=c0,X=wx0*TP+PXO+u+ST.ox[q]*TP,Y=wy0*TP+PXO+v-ST.oz[q]*TP,h=dioHash(X*3+7,(Y>>(g===1?1:0))*5+11);
   const ts=pix[S][0];if(ts){const sc_=ts.d[(v%ts.h)*ts.w+(u%ts.w)],l=(c&255)*.3+((c>>8)&255)*.59+((c>>16)&255)*.11;
    if(g===1&&pav[k]){/* moss in the joints of paving, a blade or two over its first pixels */if((l<lumK[k]*.9&&h<EDGE_P[d]*1.5)||(d<3&&h<EDGE_P[d]*.35))c=dioShade(sc_,d<2?.92:.8)}
    else if(g===1){if(h<EDGE_P[d])c=dioShade(sc_,(Y&1)?.86:1.04)}
    else if(g===2){if(h<EDGE_P[d]*1.15)c=sc_}
    else if(h<EDGE_P[d]*.5)c=sc_}}
  const m=bil(MF,u,v),f=pav[k]?.95+m*.1:.9+m*.2;let fr=f,fg=f,fb=f;if(!pav[k]){const hu=bil(MU,u,v);fr*=1+hu;fg*=1+hu*.25;fb*=1-hu*.8}
  out[i]=(c&0xff000000)|(Math.min(255,((c>>16)&255)*fb)<<16)|(Math.min(255,((c>>8)&255)*fg)<<8)|Math.min(255,(c&255)*fr)}if(v%40===39)yield}
 /* v22: wet ground along the water's edge: darker and a little cooler within about half a metre */
 {const isW=new Uint8Array(chars.length);let has=false;for(const ch of 'wd')if(idx[ch]!=null){isW[idx[ch]]=1;has=true}
  if(has){const R=Math.max(2,Math.round(TP*.55)),D=new Uint16Array(TW*TH);let any=false;for(let i=0;i<TW*TH;i++){if(isW[map[i]]){D[i]=0;any=true}else D[i]=999}
   if(any){for(let v=0;v<TH;v++)for(let u=0;u<TW;u++){const i=v*TW+u;let d=D[i];if(u>0&&D[i-1]+1<d)d=D[i-1]+1;if(v>0&&D[i-TW]+1<d)d=D[i-TW]+1;D[i]=d}
    for(let v=TH-1;v>=0;v--)for(let u=TW-1;u>=0;u--){const i=v*TW+u;let d=D[i];if(u<TW-1&&D[i+1]+1<d)d=D[i+1]+1;if(v<TH-1&&D[i+TW]+1<d)d=D[i+TW]+1;D[i]=d}
    for(let i=0;i<TW*TH;i++){const d=D[i];if(d===0||d>=R)continue;const u=i%TW,v=(i/TW)|0,q=cellOf(u,v),k=1-d/R,f=1-.26*k*k*(.8+.4*dioHash(Math.round(xsOf(u,q)*TP),Math.round(zsOf(v,q)*TP))),c=out[i];
     out[i]=(c&0xff000000)|(Math.min(255,((c>>16)&255)*f*1.03)<<16)|(Math.min(255,((c>>8)&255)*f)<<8)|Math.min(255,(c&255)*f*.96)}}}
  yield}
 /* v18: cliff and terrace edges. Step cells are half a metre (TP/2 pixels); image rows run from the far edge */
 const E=dioSteps(sc),X0=wx0*TP+PXO,Y0=wy0*TP+PXO;if(E){dioStepCorners(E);const half=TP/2,sh=(x,y,k)=>{x-=X0;y-=Y0;if(x<0||y<0||x>=TW||y>=TH)return;const i=y*TW+x,c=out[i];out[i]=(c&0xff000000)|((((c>>16)&255)*k)<<16)|((((c>>8)&255)*k)<<8)|((c&255)*k)};
  const hAt=(i,j)=>E.H[clamp(j,0,E.h-1)*E.w+clamp(i,0,E.w-1)];
  /* only the half-metre cells under this rectangle (and one round it) */
  const i0=Math.max(0,Math.floor(X0/half)-P*2-2),i1=Math.min(E.w,Math.ceil((X0+TW)/half)-P*2+2),jA=(THf-Y0-TH)/half-P*2-1,j0=Math.max(0,Math.floor(jA)-2),j1=Math.min(E.h,Math.ceil(jA+TH/half)+3);
  for(let j=j0;j<j1;j++){for(let i=i0;i<i1;i++){const h=hAt(i,j),x0=(i+P*2)*half,y0=(THf-(j+1+P*2)*half);
   /* neighbours: toward the camera (j-1), away (j+1), left, right; a higher cell gets a lip, a lower one a shadow at the foot */
   for(const [di,dj,side] of [[0,-1,'s'],[0,1,'n'],[-1,0,'w'],[1,0,'e']]){const d=h-hAt(i+di,j+dj);if(Math.abs(d)<.12)continue;if(E.sl&&dioStepJoined(E,i,j,di,dj))continue;
    for(let t=0;t<half;t++){const px=side==='s'||side==='n'?x0+t:side==='w'?x0:x0+half-1,py=side==='s'?y0+half-1:side==='n'?y0:y0+t;
     if(d>0)sh(px,py,1.22);else{const depth=Math.min(4,1+Math.round(-d*2*TP/32)),dpx=Math.max(1,Math.round(TP/32));for(let k=0;k<depth;k++){const ox=side==='w'?k:side==='e'?-k:0,oy=side==='s'?-k:side==='n'?k:0;sh(px+ox,py+oy,.62+k*.09)}}}}}if(j%32===31)yield}}
 /* the 3D renderer's ground normal map and shine (brighter pixels stand proud, by how bumpy each terrain is), made here
    in slices too; the material per pixel follows the tile it came from */
 const NS=o.nhalf?2:1,NW=TW/NS|0,NH=TH/NS|0;/* v46: the near ring's normal map is half size: worked out at every other pixel */
 let nrm=null;if(o.normals!==false&&typeof DGL_TERRAIN_MAT!=='undefined'){yield;nrm=new Uint8Array(NW*NH*4);const Lm=new Float32Array(TW*TH);for(let i=0;i<TW*TH;i++){const c=out[i];Lm[i]=((c&255)*.3+((c>>8)&255)*.59+((c>>16)&255)*.11)/255}
  const matK=T.map((t,i)=>DGL_TERRAIN_MAT[chars[i]]||[1,.05]),ps=TP/32;/* the fine grain is per pixel; at small sizes it is gentler */
  /* v44: a coarser relief under the fine grain: the picture's brightness, blurred over about half a metre */
  const cs=Math.max(1,TP>>3),RW=Math.ceil(TW/cs),RH=Math.ceil(TH/cs),Lc=new Float32Array(RW*RH),Lb=new Float32Array(RW*RH);
  for(let v=0;v<RH;v++){for(let u=0;u<RW;u++){let a=0,n=0;for(let y=v*cs;y<Math.min(TH,v*cs+cs);y++)for(let x=u*cs;x<Math.min(TW,u*cs+cs);x++){a+=Lm[y*TW+x];n++}Lc[v*RW+u]=n?a/n:0}if(v%128===127)yield}
  for(let pass=0;pass<2;pass++){for(let v=0;v<RH;v++)for(let u=0;u<RW;u++){let a=0,n=0;for(let k=-2;k<=2;k++){const x=u+k;if(x>=0&&x<RW){a+=Lc[v*RW+x];n++}}Lb[v*RW+u]=a/n}
   for(let v=0;v<RH;v++)for(let u=0;u<RW;u++){let a=0,n=0;for(let k=-2;k<=2;k++){const y=v+k;if(y>=0&&y<RH){a+=Lb[y*RW+u];n++}}Lc[v*RW+u]=a/n}yield}
  /* v46: written out without a small array per pixel (it was the slowest part of painting) */
  const mk0=new Float32Array(matK.map(m=>m[0])),mk1=new Float32Array(matK.map(m=>m[1])),mk2=new Uint8Array(matK.map(m=>m[2]?1:0));
  for(let v=0;v<TH;v+=NS){const cv=Math.min(RH-1,(v/cs)|0),cvU=Math.min(RH-1,cv+1),cvD=Math.max(0,cv-1),vU=Math.min(TH-1,v+NS)*TW,vD=Math.max(0,v-NS)*TW,vr=v*TW,nr=(v/NS|0)*NW;
   for(let u=0;u<TW;u+=NS){const i=vr+u,k=map[i],cu=Math.min(RW-1,(u/cs)|0),rx=(Lc[cv*RW+Math.min(RW-1,cu+1)]-Lc[cv*RW+Math.max(0,cu-1)])*.5,ry=(Lc[cvU*RW+cu]-Lc[cvD*RW+cu])*.5;
    const gx=(Lm[vr+Math.min(TW-1,u+NS)]-Lm[vr+Math.max(0,u-NS)])*.5*ps/NS+rx*2.2,gy=(Lm[vU+u]-Lm[vD+u])*.5*ps/NS+ry*2.2;let nx,nz;
    if(mk2[k]){const g=Math.sqrt(gx*gx+gy*gy);if(g<.07){nx=0;nz=0}else{const kk=Math.min(1,(g-.07)*6)*.45/g;nx=Math.max(-.45,Math.min(.45,-gx*kk));nz=Math.max(-.45,Math.min(.45,gy*kk))}}
    else{const b=mk0[k]*1.4;nx=Math.max(-.8,Math.min(.8,-gx*b));nz=Math.max(-.8,Math.min(.8,gy*b))}
    const o=(nr+(u/NS|0))*4;nrm[o]=(nx*.5+.5)*255;nrm[o+1]=(nz*.5+.5)*255;nrm[o+2]=255;nrm[o+3]=mk1[k]*255}if(v%64>=64-NS)yield}}
 /* the rectangle asked for, without the margin */
 const OW=R0[2]*TP,OH=R0[3]*TP,mx=Mp*TP,px=new Uint32Array(OW*OH),ow=OW/NS|0,oh=OH/NS|0,nmx=mx/NS|0,nr=nrm?new Uint8Array(ow*oh*4):null;
 for(let y=0;y<OH;y++)px.set(out.subarray((y+mx)*TW+mx,(y+mx)*TW+mx+OW),y*OW);
 if(nr)for(let y=0;y<oh;y++)nr.set(nrm.subarray(((y+nmx)*NW+nmx)*4,((y+nmx)*NW+nmx+ow)*4),y*ow*4);
 const ep=pix[eI][0];let r=0,gg=0,b=0,n=0;if(ep)for(let i=0;i<ep.d.length;i+=3){const c=ep.d[i];r+=c&255;gg+=(c>>8)&255;b+=(c>>16)&255;n++}
 return {w:OW,h:OH,px,nrm:nr,nw:ow,nh:oh,TP,avg:n?`rgb(${r/n|0},${gg/n|0},${b/n|0})`:'#6CBA59'}}
/* the whole picture of a scene: the Lite renderer's canvas (32 px a metre when it fits, else 16), or for the 3D
   renderer the distant picture (8 px a metre; the near ring paints the 16 m squares round you at full size) */
function* dioGroundGen(sc,pr=0,rec=null){const full=DIO_FAR_TP;
 const r=yield* (typeof pwPaint==='function'?pwPaint(sc,{TP:full,margin:0,pr,rec}):dioPaintGen(sc,{TP:full,margin:0}));
 const g={width:r.w,height:r.h,_px:new Uint8Array(r.px.buffer)};
 g._nrm=r.nrm;g._avg=r.avg;g._TP=full;return g}
const DIO_FAR_TP=8;
function dioBuildGround(sc){const pw=typeof PW!=='undefined'?PW:null;if(pw)pw.sync++;/* (all here, now: no waiting on the helper) */try{const it=dioGroundGen(sc);let r=it.next();while(!r.done)r=it.next();return r.value}finally{if(pw)pw.sync--}}
/* built pictures, newest last; a scene you come back to opens at once */
const DIO_GCACHE=new Map();
function dioGroundCached(key){const g=DIO_GCACHE.get(key);if(g){DIO_GCACHE.delete(key);DIO_GCACHE.set(key,g)}return g||null}
/* v41: a 32 px ground picture of a big scene is 15-25 MB; phones keep two (the scene you left and the one you are in), computers four */
const DIO_GKEEP=/Android|iPhone|iPad/.test(navigator.userAgent)?2:4;
function dioGroundKeep(key,g){DIO_GCACHE.set(key,g);while(DIO_GCACHE.size>DIO_GKEEP){const k=DIO_GCACHE.keys().next().value,old=DIO_GCACHE.get(k);DIO_GCACHE.delete(k);if(old&&old.getContext){old.width=1;old.height=1}}}
/* build a scene's ground in slices of about 8 ms, so frames keep coming while it's made */
/* alpha 0.4: pr = its place in the painter helper's queue (lower first): the view being opened -10, one needed
   soon -5, one only looked ahead to 10; the squares round you 0 to 3 */
/* (one build per ground at a time: a second asker waits for the first, moving it up the queue if it is needed sooner) */
const DIO_GPEND=new Map();
async function dioGroundAsync(sc,pr=0){const key=dioGroundKey(sc);if(dioGroundCached(key))return;const pend=DIO_GPEND.get(key);
 if(pend){if(pr<pend.rec.pr){pend.rec.pr=pr;if(pend.rec.id&&typeof PW!=='undefined'&&PW.w)PW.w.postMessage({t:'prio',id:pend.rec.id,pr})}return pend.p}
 const rec={pr,id:0},p=(async()=>{const it=dioGroundGen(sc,pr,rec);let r,t0=performance.now();
  for(;;){r=it.next();if(r.done)break;if(r.value===PW_WAIT){await pwSettle();t0=performance.now();continue}if(performance.now()-t0>8){await new Promise(res=>setTimeout(res,0));t0=performance.now()}}dioGroundKeep(key,r.value)})();
 DIO_GPEND.set(key,{rec,p});try{await p}finally{DIO_GPEND.delete(key)}}
/* v27: the water cells belong to the scene (a ground picture from the cache used to leave the last scene's here) */
function dioWaterOf(sc){const rows=sc.tiles||[];if(sc._wRows===rows&&sc._wKey===rows.join(''))return sc._water;const W=sc.w,H=sc.h,out=[];for(let j=0;j<H;j++)for(let i=0;i<W;i++){const ch=(rows[j]||'')[i];if(ch==='w'||ch==='d')out.push([i+.5,H-j-.5])}
 Object.defineProperty(sc,'_water',{value:out,writable:true,configurable:true,enumerable:false});Object.defineProperty(sc,'_wRows',{value:rows,writable:true,configurable:true,enumerable:false});Object.defineProperty(sc,'_wKey',{value:rows.join(''),writable:true,configurable:true,enumerable:false});return out}
function dioEnsureGround(){const sc=DIO.sc,key=dioGroundKey(sc);if(key!==DIO.gkey||!DIO.ground){const c=dioGroundCached(key);DIO.ground=c||dioBuildGround(sc);if(!c)dioGroundKeep(key,DIO.ground);DIO.gkey=key;DIO.cand=null;DIO.nav=null;DIO.water=dioWaterOf(sc)}return DIO.ground}
function dioTer(x,z){const sc=DIO.sc,i=Math.floor(x),j=sc.h-1-Math.floor(z);return (i<0||j<0||i>=sc.w||j>=sc.h)?sc.edge:((sc.tiles||[])[j]||'')[i]||sc.edge}
/* ---------- polylines ---------- */
function dioPoly(pts){let L=0;const seg=[];for(let i=0;i<pts.length-1;i++){seg.push(L);L+=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1])}return {p:pts,seg,L}}
function dioPolyAt(P,d){const p=P.p;if(p.length<2)return {x:p[0][0],z:p[0][1],dx:0,dz:0};d=clamp(d,0,P.L);
 for(let i=0;i<p.length-1;i++){const s=P.seg[i],e=i+1<P.seg.length?P.seg[i+1]:P.L;if(d<=e||i===p.length-2){const l=e-s,k=l?clamp((d-s)/l,0,1):0,a=p[i],b=p[i+1];return {x:a[0]+(b[0]-a[0])*k,z:a[1]+(b[1]-a[1])*k,dx:b[0]-a[0],dz:b[1]-a[1]}}}}
function dioPolyNear(P,x,z){let best=0,bd=1e9;const p=P.p;for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1],vx=b[0]-a[0],vz=b[1]-a[1],l2=vx*vx+vz*vz||1e-9,k=clamp(((x-a[0])*vx+(z-a[1])*vz)/l2,0,1),px=a[0]+vx*k,pz=a[1]+vz*k,d=Math.hypot(px-x,pz-z);
 if(d<bd){bd=d;best=P.seg[i]+Math.sqrt(l2)*k}}return best}
function dioAlong(sc,t){const P=dioPoly(sc.path&&sc.path.length>1?sc.path:[[0,sc.h*.4],[sc.w,sc.h*.4]]);return dioPolyAt(P,clamp(t,0,1)*P.L)}
function dioHubOf(sc){if(sc.hub)return sc.hub;const a=dioAlong(sc,sc.start??.42);return [a.x,a.z]}
/* ---------- steps (v18): terraces, cliffs, stairs and ledges on a half-metre grid ----------
   scene.steps: the raise of each half-metre cell above the smooth ground, in 5 cm units (Int16, base64, row 0 at the near
   edge, x across). Neighbouring cells at different raises meet in a vertical wall: a cliff, a terrace front, a stair riser.
   scene.stepm: per cell (Uint8, base64) the wall material in the low 4 bits (0 = the scene's own rock) and flag 16 = a
   ledge: you can hop down from this cell, never climb up. Stairs are cells that rise a little at a time. */
const DIO_STEPS=new WeakMap(),DIO_RISE=.34,DIO_HOP=1.8;
function dioB64(s,Type){if(!s)return null;try{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new Type(u.buffer,0,Math.floor(u.length/Type.BYTES_PER_ELEMENT))}catch(e){return null}}
function dioB64Out(a){const u=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)}
function dioSteps(sc){if(!sc||!sc.steps)return null;let E=DIO_STEPS.get(sc);if(E&&E.s===sc.steps&&E.m0===sc.stepm&&E.w===sc.w*2)return E;const w=sc.w*2,h=sc.h*2,raw=dioB64(sc.steps,Int16Array),m=dioB64(sc.stepm,Uint8Array);
 const H=new Float32Array(w*h);if(raw&&raw.length===w*h)for(let i=0;i<w*h;i++)H[i]=raw[i]/20;E={s:sc.steps,m0:sc.stepm,w,h,H,M:m&&m.length===w*h?m:new Uint8Array(w*h)};DIO_STEPS.set(sc,E);return E}
/* an empty step grid for a scene (the Studio paints into it) and storing an edited one back */
function dioStepsNew(sc){const w=sc.w*2,h=sc.h*2,E={s:null,m0:null,w,h,H:new Float32Array(w*h),M:new Uint8Array(w*h)};return E}
function dioStepsStore(sc,E){const raw=new Int16Array(E.w*E.h);let any=false;for(let i=0;i<raw.length;i++){raw[i]=Math.round(E.H[i]*20);if(raw[i]||E.M[i])any=true}
 if(!any){delete sc.steps;delete sc.stepm;DIO_STEPS.delete(sc);return}sc.steps=dioB64Out(raw);sc.stepm=dioB64Out(E.M);E.s=sc.steps;E.m0=sc.stepm;DIO_STEPS.set(sc,E);sc.stepsV=(sc.stepsV||0)+1}
/* two neighbouring cells meet without a step when their corners on the shared edge agree (a slope) */
function dioStepJoined(E,i,j,di,dj){const ii=i+di,jj=j+dj;if(ii<0||jj<0||ii>=E.w||jj>=E.h)return false;const q=j*E.w+i,r=jj*E.w+ii;
 const A=di?[[di>0?1:0,0],[di>0?1:0,1]]:[[0,dj>0?1:0],[1,dj>0?1:0]];for(const [ci,cj] of A){const B=[di?1-ci:ci,dj?1-cj:cj];if(Math.abs(dioStepCH(E,q,ci,cj)-dioStepCH(E,r,B[0],B[1]))>.03)return false}return true}
function dioStepCell(x,z,E){return clamp(Math.floor(z*2),0,E.h-1)*E.w+clamp(Math.floor(x*2),0,E.w-1)}
/* v23: slopes. A step cell flagged 32 is a ramp: instead of lying flat at its own height it leans between its
   neighbours. Each corner touching a ramp cell takes the average height of the cells around it that are within a
   step of the ramp, and those cells use that corner height too, so a ramp meets the ground above and below it with
   no riser. dioStepCorners caches the corners (NaN where a corner is ordinary). */
function dioStepCorners(E){if(E.cs===E.s&&E.cm===E.m0&&E.C&&E.cs!=null)return E.C;const w=E.w,h=E.h,C=new Float32Array((w+1)*(h+1)).fill(NaN);let any=false;
 for(let j=0;j<=h;j++)for(let i=0;i<=w;i++){let sum=0,n=0,rs=0,rn=0;const cells=[];for(const [a,b] of [[-1,-1],[0,-1],[-1,0],[0,0]]){const ii=i+a,jj=j+b;if(ii<0||jj<0||ii>=w||jj>=h)continue;const q=jj*w+ii;cells.push(q);if(E.M[q]&32){rs+=E.H[q];rn++}}
  if(!rn)continue;const m=rs/rn;for(const q of cells){if(Math.abs(E.H[q]-m)<=.45){sum+=E.H[q];n++}}C[j*(w+1)+i]=sum/n;any=true}
 E.C=C;E.cs=E.s;E.cm=E.m0;E.sl=any;return C}
/* the height of cell q's corner (ci,cj in 0/1): the shared ramp height when the corner is part of a slope, else the cell's own */
function dioStepCH(E,q,ci,cj){const C=dioStepCorners(E);if(!E.sl)return E.H[q];const i=q%E.w,j=(q-i)/E.w,c=C[(j+cj)*(E.w+1)+i+ci];return c===c&&Math.abs(c-E.H[q])<=.45?c:E.H[q]}
/* alpha 0.2: natural terrace edges. Where a terrace or cliff of rock drops by 0.7 m or more, the ground on top rounds
   down toward the edge (a shoulder) and the ground below rises toward it (a fan of scree), so the rock face in between
   is shorter and the hill reads as a hill. How much changes along the edge, so the face's height wavers. At least
   0.45 m of face is always left, so a terrace you couldn't climb before still can't be climbed (and one you could,
   still can). Built walls (brick, dressed stone, boards, steps, concrete, hedges), ledges, ramps and stairs, water's
   edge and the foot of a ladder keep their shape. dioShape holds an offset for each corner of each half-metre cell,
   the same for every cell of one level that shares the corner, so the ground stays joined. */
const DIO_NATW=new Set([1,2,3,9,11]);
function dioShape(sc,E){if(!E||DIO.noShape)return null;if(E.shS===E.s&&E.shM===E.m0&&E.shD)return E.SH;E.shS=E.s;E.shM=E.m0;E.shD=1;E.SH=null;
 const w=E.w,h=E.h,H=E.H,M=E.M,wd=typeof dglWallDefault==='function'?dglWallDefault(sc):1,nat=q=>{let m=M[q]&15;if(!m)m=wd;return DIO_NATW.has(m)&&!(M[q]&48)};
 /* corners that keep their shape: around stairs and ramps, at the water's edge, at the foot and top of a ladder */
 const kc=new Uint8Array((w+1)*(h+1)),keepAt=(ci,cj,r)=>{for(let b=-r;b<=r;b++)for(let a=-r;a<=r;a++){const ii=ci+a,jj=cj+b;if(ii>=0&&jj>=0&&ii<=w&&jj<=h)kc[jj*(w+1)+ii]=1}};
 for(let q=0;q<w*h;q++){if((M[q]&32)||(M[q]&15)===8){const i=q%w;keepAt(i,(q-i)/w,4)}}
 const rows=sc.tiles||[];for(let j=0;j<h;j++)for(let i=0;i<w;i++){const ch=(rows[sc.h-1-Math.floor(j/2)]||'')[Math.floor(i/2)];if(ch==='w'||ch==='d')keepAt(i,j,3)}
 const C=dioData().sc;for(const p of sc.props||[]){const P=C.props[p.k];if(p.act==='climb'||/ladder/.test(p.k)||(P&&P.walk))keepAt(Math.round(p.x*2),Math.round(p.z*2),4)}
 /* (and both ends of a bridge, which meets the land at a fixed height) */
 for(const b of sc.bridges||[])for(const e of [b.a,b.b])if(e)keepAt(Math.round(e[0]*2),Math.round(e[1]*2),5);
 const SN=new Float32Array(w*h*4),SP=new Float32Array(w*h*4);let any=false;
 const splat=(lev,ex,ez,R,amt)=>{const i0=Math.max(0,Math.floor((ex-R)*2)-1),i1=Math.min(w-1,Math.ceil((ex+R)*2)),j0=Math.max(0,Math.floor((ez-R)*2)-1),j1=Math.min(h-1,Math.ceil((ez+R)*2));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const q=j*w+i;if(Math.abs(H[q]-lev)>.05)continue;for(let k=0;k<4;k++){const ci=i+(k&1),cj=j+(k>>1);if(kc[cj*(w+1)+ci])continue;const d=Math.hypot(ci/2-ex,cj/2-ez);if(d>=R)continue;
   const v=amt*(1-smooth01(d/R));if(amt<0){if(v<SN[q*4+k])SN[q*4+k]=v}else if(v>SP[q*4+k])SP[q*4+k]=v;any=true}}};
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){const q=j*w+i;for(const [di,dj] of [[1,0],[0,1]]){const ii=i+di,jj=j+dj;if(ii>=w||jj>=h)continue;const r=jj*w+ii,d=H[q]-H[r],D=Math.abs(d);if(D<.7)continue;
  const hi=d>0?q:r,lo=d>0?r:q;if(!nat(hi)||(M[lo]&48))continue;const ex=di?(i+1)/2:(i+.5)/2,ez=dj?(j+1)/2:(j+.5)/2,nz=Math.sin(ex*12.9898+ez*78.233)*43758.5453,va=.7+.6*(nz-Math.floor(nz));
  /* (gentle enough to walk on: under 0.3 m of rise per half metre at the steepest) */
  const Rs=clamp(.9*D,1,2.5),Rc=clamp(.6*D,.75,1.75);let S=Math.min(.38*D,1,.4*Rs)*va,Cs=Math.min(.22*D,.6,.4*Rc)*va;S=Math.min(S,.4*Rs);Cs=Math.min(Cs,.4*Rc);const k=clamp((D-.45)/(S+Cs),0,1);S*=k;Cs*=k;splat(H[hi],ex,ez,Rs,-S);splat(H[lo],ex,ez,Rc,Cs)}}
 if(!any)return null;for(let i=0;i<SN.length;i++)SN[i]+=SP[i];
 /* walking stays as it was: on one level, neighbouring corners (half a metre apart) differ by 0.28 m at most, so no
    new step is too high to take; across a wall that was too high to climb, at least 0.45 m of it is left. Every
    copy of a shared corner on one level takes the smallest change, so the ground stays joined. A few rounds settle it. */
 const lvl=(a,b)=>Math.abs(a-b)<=.05,PAIRS=[[0,1],[0,2],[1,3],[2,3]];
 const unify=()=>{for(let J=0;J<=h;J++)for(let I=0;I<=w;I++){const cp=[];for(const [di,dj,k] of [[-1,-1,3],[0,-1,2],[-1,0,1],[0,0,0]]){const i=I+di,j=J+dj;if(i<0||j<0||i>=w||j>=h)continue;cp.push((j*w+i)*4+k)}
   for(let a=0;a<cp.length;a++){const ha=H[cp[a]>>2];let best=SN[cp[a]];for(let b=0;b<cp.length;b++)if(b!==a&&lvl(H[cp[b]>>2],ha)&&Math.abs(SN[cp[b]])<Math.abs(best))best=SN[cp[b]];SN[cp[a]]=best}}};
 for(let it=0;it<10;it++){let ch=0;
  for(let q=0;q<w*h;q++)for(const [a,b] of PAIRS){const A=q*4+a,B=q*4+b,d=SN[A]-SN[B];if(Math.abs(d)>.28){const ex=Math.abs(d)-.28;if(Math.abs(SN[A])>Math.abs(SN[B]))SN[A]-=Math.sign(SN[A])*Math.min(ex,Math.abs(SN[A]));else SN[B]-=Math.sign(SN[B])*Math.min(ex,Math.abs(SN[B]));ch++}}
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){const q=j*w+i;for(const [di,dj,ka,kb] of [[1,0,[1,3],[0,2]],[0,1,[2,3],[0,1]]]){const ii=i+di,jj=j+dj;if(ii>=w||jj>=h)continue;const r=jj*w+ii,D=Math.abs(H[q]-H[r]);if(D<=.05)continue;
    /* a step you could take stays one you can take (0.3 m, or as it was); one you couldn't keeps at least 0.45 m (or all of a lower one) */
    for(let n=0;n<2;n++){const A=q*4+ka[n],B=r*4+kb[n],base=H[q]-H[r],dv=SN[A]-SN[B];if(Math.abs(dv)<1e-6)continue;let tt=1;
     if(D<=DIO_RISE){const lim=Math.max(D,.3);if(Math.abs(base+dv)>lim+1e-4)tt=dv>0?(lim-base)/dv:(-lim-base)/dv}
     else{const need=Math.min(D,.45),sg=base>0?1:-1;if(sg*(base+dv)<need-1e-4)tt=(sg*base-need)/(-sg*dv)}
     tt=clamp(tt,0,1);if(tt<1){SN[A]*=tt;SN[B]*=tt;ch++}}
    /* and the same for the cells as a whole (walking goes by each cell's middle) */
    {const av=c=>(SN[c*4]+SN[c*4+1]+SN[c*4+2]+SN[c*4+3])/4,base=H[q]-H[r],dv=av(q)-av(r);if(Math.abs(dv)>1e-6){let tt=1;
     if(D<=DIO_RISE){const lim=Math.max(D,.32);if(Math.abs(base+dv)>lim)tt=dv>0?(lim-base)/dv:(-lim-base)/dv}
     else{const need=D<=.45?D-.001:.45,sg=base>0?1:-1;if(sg*(base+dv)<need)tt=(sg*base-need)/(-sg*dv)}
     tt=clamp(tt,0,1);if(tt<1){for(let k=0;k<4;k++){SN[q*4+k]*=tt;SN[r*4+k]*=tt}ch++}}}}}
  unify();if(!ch)break}
 return E.SH=SN}
/* a cell corner's height above the smooth land: its raise (or the shared ramp height), shaped at natural edges */
function dioStepCHS(E,q,ci,cj,SH){return dioStepCH(E,q,ci,cj)+(SH?SH[q*4+ci+cj*2]:0)}
function dioStep(x,z,sc=DIO.sc){const E=dioSteps(sc);if(!E)return 0;const q=dioStepCell(x,z,E);dioStepCorners(E);const SH=dioShape(sc,E);if(!E.sl&&!SH)return E.H[q];
 const fx=clamp(x*2-Math.floor(x*2),0,1),fz=clamp(z*2-Math.floor(z*2),0,1),a=dioStepCHS(E,q,0,0,SH),b=dioStepCHS(E,q,1,0,SH),c=dioStepCHS(E,q,0,1,SH),d=dioStepCHS(E,q,1,1,SH);
 return (a*(1-fx)+b*fx)*(1-fz)+(c*(1-fx)+d*fx)*fz}
/* alpha 0.2: the terrace level a point is on (its cell's raise, not shaped): which samples belong to one level */
function dioStepLevel(x,z,sc=DIO.sc){const E=dioSteps(sc);return E?E.H[dioStepCell(x,z,E)]:0}
function dioStepM(x,z,sc=DIO.sc){const E=dioSteps(sc);return E?E.M[dioStepCell(x,z,E)]:0}
/* bridges: a deck from end a to end b, w wide; its height runs from the ground at one end to the other, with a hump
   (stone), a slight crown (wood) or a sag (rope) */
const DIO_BRIDGE_ARC={stone:.5,wood:.12,rope:-.32};
function dioBridges(sc=DIO.sc){const L=sc&&sc.bridges;if(!L||!L.length)return null;let E=DIO_STEPS.get(L);if(E&&E.v===JSON.stringify(L)+(sc.stepsV||0))return E.list;
 const list=L.map(b=>{const a=b.a,c=b.b,len=Math.hypot(c[0]-a[0],c[1]-a[1])||1,ux=(c[0]-a[0])/len,uz=(c[1]-a[1])/len,g=(x,z)=>dioHRaw(sc,x,z)+dioStep(x,z,sc);
  /* alpha 0.4: a jetty (pier: 1): one flat deck from the bank (a) out over the water (b), level with the bank and never
     closer than a hand's breadth above the water, so there is always water underneath it */
  if(b.pier){const wl=g(c[0],c[1])-.12,h=b.h??Math.max(g(a[0]-ux*.35,a[1]-uz*.35),wl+.24);return {...b,len,ux,uz,ha:h,hb:h,arc:0,w:b.w||1.4}}
  return {...b,len,ux,uz,ha:b.ha??g(a[0]-ux*.3,a[1]-uz*.3),hb:b.hb??g(c[0]+ux*.3,c[1]+uz*.3),arc:(b.arc??DIO_BRIDGE_ARC[b.kind||'wood']??.1)*Math.min(1,len/6),w:b.w||1.6}});
 DIO_STEPS.set(L,{v:JSON.stringify(L)+(sc.stepsV||0),list});return list}
function dioBridgeAt(x,z,sc=DIO.sc){const L=dioBridges(sc);if(!L)return null;for(const b of L){const vx=x-b.a[0],vz=z-b.a[1],t=(vx*b.ux+vz*b.uz)/b.len,s=-vx*b.uz+vz*b.ux;
  if(t>=0&&t<=1&&Math.abs(s)<=b.w/2)return b.ha+(b.hb-b.ha)*t+b.arc*Math.sin(Math.PI*t)}return null}
/* ---------- where you can walk: a half-meter grid from the terrain and the props' footprints ---------- */
function dioNav(){const sc=DIO.sc,tk=dioTimedKey(sc);if(DIO.nav&&DIO.navSc===sc&&DIO.navG===DIO.gkey&&DIO.navP===(sc.props||[]).length&&DIO.navT===tk)return DIO.nav;const C=dioData().sc,key=DIO.gkey;DIO.navSc=sc;DIO.navG=DIO.gkey;DIO.navP=(sc.props||[]).length;DIO.navT=tk;
 const N=DIO_N,gw=Math.max(1,Math.round(sc.w*N)),gh=Math.max(1,Math.round(sc.h*N)),rows=sc.tiles||[],PPU=C.ppu||34,blk=new Uint8Array(gw*gh),cost=new Float32Array(gw*gh).fill(1);
 for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){const ti=Math.floor(i/N),tz=Math.floor(j/N),ch=(rows[sc.h-1-tz]||'')[ti]||sc.edge,T=C.terrains[ch];
  const wk=T&&T.walk!=null?!!T.walk:(!'wd'.includes(ch)||!!sc.ride);/* v24: in a riding scene you cross water on your billionaire */if(!wk)blk[j*gw+i]=1;cost[j*gw+i]=(T&&T.paved)||'pcmbaqhe'.includes(ch)?.7:ch==='t'?1.25:ch==='y'?1.1:1}
 const each=(x0,z0,x1,z1,fn)=>{for(let j=Math.max(0,Math.floor(z0*N));j<Math.min(gh,Math.ceil(z1*N));j++)for(let i=Math.max(0,Math.floor(x0*N));i<Math.min(gw,Math.ceil(x1*N));i++)fn(j*gw+i,(i+.5)/N,(j+.5)/N)};
 const disc=(cx,cz,r,v)=>each(cx-r,cz-r,cx+r,cz+r,(q,x,z)=>{if(Math.hypot(x-cx,z-cz)<=r)blk[q]=v});
 /* stepping stones and bridges open water first, then solid things close ground */
 for(const p of sc.props||[]){const M=C.props[p.k];if(M&&M.walk)disc(p.x,p.z,M.walk*(p.s||1),0)}
 for(const p of sc.props||[]){const M=C.props[p.k];if(!M||M.walk||!dioPropOn(p))continue;const s=p.s||1,f=p.f?-1:1;
  if(M.box){const w=M.box[0]*s,d=M.box[1]*s;if(p.rot){/* alpha 0.4: a turned building blocks its turned footprint (it turns about its door) */const r=p.rot*Math.PI/180,c=Math.cos(r),sn=Math.sin(r),e=Math.hypot(w/2,d+.1);
    each(p.x-e,p.z-e,p.x+e,p.z+e,(q,x,z)=>{const lx=(x-p.x)*c+(z-p.z)*sn,lz=-(x-p.x)*sn+(z-p.z)*c;if(lx>=-w/2&&lx<=w/2&&lz>=-.1&&lz<=d)blk[q]=1})}else each(p.x-w/2,p.z-.1,p.x+w/2,p.z+d,q=>blk[q]=1)}
  else if(M.posts)for(const o of M.posts)disc(p.x+o.x/PPU*s*f,p.z+.15,(o.r||.4)*s,1);
  else{const r=M.solid!=null?M.solid*s:M.flat?0:(M.shadow||0)*.42*s;if(r>.05)disc(p.x,p.z+r*.2,r,1)}}
 /* v46: inside a room laid into the place you walk only on its floor */
 if(sc.roomRect){const R=sc.roomRect,a0=R[0]+.3,a1=R[0]+R[2]-.3,b0=R[1]+.25,b1=R[1]+R[3]-.3;for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){const x=(i+.5)/N,z=(j+.5)/N;if(x<a0||x>a1||z<b0||z>b1)blk[j*gw+i]=1}}
 /* alpha 0.2: in a joined view you walk in the place and where the next places meet it, not out into the countryside */
 if(sc.inside){const I=sc.inside;for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){const x=(i+.5)/N,z=(j+.5)/N;let ok=false;for(const r of I)if(x>=r[0]&&x<r[2]&&z>=r[1]&&z<r[3]){ok=true;break}if(!ok)blk[j*gw+i]=1}}
 /* v18: the height you stand at in each cell (ground, terrace, stair or bridge deck) and where you may hop down a ledge;
    a bridge deck opens the water or the drop under it */
 const lv=new Float32Array(gw*gh),hop=new Uint8Array(gw*gh),E=dioSteps(sc),BR=dioBridges(sc);
 for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){const x=(i+.5)/N,z=(j+.5)/N,q=j*gw+i;const ec=E?dioStepCell(x,z,E):0,SH=E?dioShape(sc,E):null;let h=dioHRaw(sc,x,z)+(E?E.H[ec]+(SH?(SH[ec*4]+SH[ec*4+1]+SH[ec*4+2]+SH[ec*4+3])/4:0):0);
  if(BR){const d=dioBridgeAt(x,z,sc);if(d!=null){h=d;blk[q]=0;cost[q]=.75}}lv[q]=h;if(E&&E.M[dioStepCell(x,z,E)]&16)hop[q]=1}
 if(BR)for(const p of sc.props||[]){const M=C.props[p.k];if(M&&M.box&&!M.walk){const w=M.box[0]*(p.s||1),d=M.box[1]*(p.s||1);each(p.x-w/2,p.z-.1,p.x+w/2,p.z+d,q=>blk[q]=1)}}
 /* arches: you walk between the piers, not through them */
 for(const a of sc.arches||[]){const w=a.w||2.4,d=a.d||1,pr=a.pier||(a.kind==='rock'?.95:.55),az=(a.dir||'z')==='z';for(const s2 of [-1,1]){const o=s2*(w/2+pr/2);
  if(az)each(a.x+o-pr/2,a.z,a.x+o+pr/2,a.z+d,q=>blk[q]=1);else each(a.x,a.z+o-pr/2,a.x+d,a.z+o+pr/2,q=>blk[q]=1)}}
 DIO.navKey=key;return DIO.nav={N,gw,gh,blk,cost,lv,hop}}
/* may you step from nav cell c to its neighbour q? Up to DIO_RISE up or down; further down only off a ledge */
function dioPass(G,c,q,noHop){const d=G.lv[q]-G.lv[c];if(d>DIO_RISE)return false;if(d<-DIO_RISE)return !noHop&&!!G.hop[c]&&d>-DIO_HOP;return true}
/* a straight step from a to b (keyboard walking, animals): free at b and no wall in between */
function dioStepOK(ax,az,bx,bz,noHop){const G=dioNav(),c=dioCell(ax,az),q=dioCell(bx,bz);if(q<0||G.blk[q])return false;if(c<0||c===q)return true;return dioPass(G,c,q,noHop)}
function dioCell(x,z){const G=dioNav(),i=Math.floor(x*G.N),j=Math.floor(z*G.N);return (i<0||j<0||i>=G.gw||j>=G.gh)?-1:j*G.gw+i}
function dioFree(x,z){const c=dioCell(x,z);return c>=0&&!DIO.nav.blk[c]}
function dioNearFree(x,z){const G=dioNav(),{N,gw,gh,blk}=G,ci=clamp(Math.floor(x*N),0,gw-1),cj=clamp(Math.floor(z*N),0,gh-1);if(!blk[cj*gw+ci])return {i:ci,j:cj};
 for(let r=1;r<40;r++){let best=null,bd=1e9;for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++){if(Math.max(Math.abs(di),Math.abs(dj))!==r)continue;const i=ci+di,j=cj+dj;if(i<0||j<0||i>=gw||j>=gh||blk[j*gw+i])continue;const d=di*di+dj*dj;if(d<bd){bd=d;best={i,j}}}if(best)return best}return null}
function dioFreePt(x,z){const c=dioNearFree(x,z);if(!c)return [x,z];if(dioFree(x,z))return [x,z];return [(c.i+.5)/DIO_N,(c.j+.5)/DIO_N]}
function dioLOS(a,b,mc){const G=dioNav(),n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.18)+1;let pc=-1;for(let k=0;k<=n;k++){const c=dioCell(a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n);if(c<0||G.blk[c])return false;if(mc!=null&&G.cost[c]>mc+.01)return false;
  if(pc>=0&&c!==pc&&Math.abs(G.lv[c]-G.lv[pc])>DIO_RISE)return false;pc=c}return true}
function dioCostAt(p){const c=dioCell(p[0],p[1]);return c<0?1:DIO.nav.cost[c]}
/* A* on the grid (8 directions, no corner cutting), then string-pulled so people walk in straight lines */
function dioFind(ax,az,bx,bz,o={}){const G=dioNav(),{N,gw,gh,blk,cost}=G,a=dioNearFree(ax,az),b=dioNearFree(bx,bz);if(!a||!b)return null;const noHop=!!o.noHop;
 const s=a.j*gw+a.i,e=b.j*gw+b.i,start=dioFree(ax,az)?[ax,az]:[(a.i+.5)/N,(a.j+.5)/N],end=dioFree(bx,bz)?[bx,bz]:[(b.i+.5)/N,(b.j+.5)/N];
 if(s===e||dioLOS(start,end,Math.max(dioCostAt(start),dioCostAt(end))))return [start,end];
 const n=gw*gh;if(!DIO._g||DIO._g.length!==n){DIO._g=new Float32Array(n);DIO._p=new Int32Array(n);DIO._c=new Uint8Array(n)}const g=DIO._g,par=DIO._p,cl=DIO._c;g.fill(Infinity);par.fill(-1);cl.fill(0);
 const H=[],F=[],push=(i,f)=>{H.push(i);F.push(f);let k=H.length-1;while(k>0){const p=(k-1)>>1;if(F[p]<=F[k])break;[H[p],H[k]]=[H[k],H[p]];[F[p],F[k]]=[F[k],F[p]];k=p}},
  pop=()=>{const top=H[0],li=H.pop(),lf=F.pop();if(H.length){H[0]=li;F[0]=lf;let k=0;for(;;){const l=2*k+1,r=l+1;let m=k;if(l<H.length&&F[l]<F[m])m=l;if(r<H.length&&F[r]<F[m])m=r;if(m===k)break;[H[m],H[k]]=[H[k],H[m]];[F[m],F[k]]=[F[k],F[m]];k=m}}return top};
 const ei=e%gw,ej=(e/gw)|0,h=i=>{const dx=Math.abs(i%gw-ei),dy=Math.abs(((i/gw)|0)-ej);return (Math.max(dx,dy)+.414*Math.min(dx,dy))*.7};
 g[s]=0;push(s,h(s));let found=false,it=0;
 while(H.length&&it++<(o.max||30000)){const c=pop();if(c===e){found=true;break}if(cl[c])continue;cl[c]=1;const ci=c%gw,cj=(c/gw)|0;
  for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){if(!di&&!dj)continue;const ni=ci+di,nj=cj+dj;if(ni<0||nj<0||ni>=gw||nj>=gh)continue;const q=nj*gw+ni;if(blk[q]||cl[q])continue;if(di&&dj&&(blk[cj*gw+ni]||blk[nj*gw+ci]))continue;
   if(di&&dj){if(Math.abs(G.lv[q]-G.lv[c])>DIO_RISE||Math.abs(G.lv[cj*gw+ni]-G.lv[c])>DIO_RISE||Math.abs(G.lv[nj*gw+ci]-G.lv[c])>DIO_RISE)continue}else if(!dioPass(G,c,q,noHop))continue;
   const ng=g[c]+(di&&dj?1.414:1)*(cost[q]+cost[c])*.5;if(ng<g[q]){g[q]=ng;par[q]=c;push(q,ng+h(q))}}}
 if(!found)return null;const cells=[];for(let c=e;c!==-1;c=par[c])cells.push(c);cells.reverse();
 const pts=[start,...cells.slice(1,-1).map(c=>[(c%gw+.5)/N,(((c/gw)|0)+.5)/N]),end],out=[pts[0]];let i=0;
 while(i<pts.length-1){let j=pts.length-1;while(j>i+1&&!dioLOS(pts[i],pts[j],Math.max(dioCostAt(pts[i]),dioCostAt(pts[j]))))j--;out.push(pts[j]);i=j}
 return out}
/* ---------- encounter spots: tall grass first, around where you stand ---------- */
function dioCandidates(sc){/* alpha 0.2: on a trip through a place's view, round where your steps have taken you (not the place's middle) */const st=DIO.st,trip=st&&st.mode==='road'&&st.pos&&sc.comp&&sc.comp.hubOf!=null,ck=trip?Math.round(st.pos[0]/6)+','+Math.round(st.pos[1]/6):'hub';
 if(DIO.cand&&DIO.candK===ck)return DIO.cand;DIO.candK=ck;const out=[],good='tgGfnsxCH',rows=sc.tiles||[],hub=trip?st.pos:dioHubOf(sc),ex=sc.exits||[];dioNav();
 for(let j=0;j<sc.h;j++)for(let i=1;i<sc.w-1;i++){const ch=(rows[j]||'')[i];if(!good.includes(ch))continue;const x=i+.5,z=sc.h-j-.5;if(!dioFree(x,z))continue;
  const d=Math.hypot(x-hub[0],z-hub[1]);if(d<2.2||d>13)continue;if(ex.some(e=>Math.hypot(e[0]-x,e[1]-z)<2.2))continue;if((sc.props||[]).some(p=>Math.hypot(p.x-x,p.z-z)<1.1))continue;
  if(!sc.hub){let dm=1e9;for(let k=0;k<=30;k++){const a=dioAlong(sc,k/30);dm=Math.min(dm,Math.hypot(a.x-x,a.z-z))}if(dm<1.2||dm>6)continue}
  out.push([x,z,(ch==='t'?4:1)*Math.exp(-d/9)])}
 if(!out.length)for(let k=1;k<10;k++){const a=dioAlong(sc,k/10);out.push([a.x,a.z+2,1])}
 return DIO.cand=out}
function dioEncSpot(sc,id,used){const C=dioCandidates(sc);let h=0;for(const ch of String(id))h=(h*31+ch.charCodeAt(0))>>>0;const tot=C.reduce((a,c)=>a+c[2],0);
 for(let tries=0;tries<12;tries++){let r=((h+tries*7919)%9973)/9973*tot,pick=C[0];for(const c of C){r-=c[2];if(r<=0){pick=c;break}}if(!used.some(u=>Math.hypot(u[0]-pick[0],u[1]-pick[1])<1.6))return pick}return C[h%C.length]}
function dioStop(){frameStop('dio');DIO.cv=null;DIO.ready=false;DIO.keys={}}
function dioCanvasXY(ev){const r=DIO.cv.getBoundingClientRect();return [(ev.clientX-r.left)/r.width*DIO.cv.width,(ev.clientY-r.top)/r.height*DIO.cv.height]}
function dioHitAt(ev){if(!DIO.cv)return null;const [x,y]=dioCanvasXY(ev);let best=null;
 for(const h of DIO.hits){if(x>=h.x0&&x<=h.x1&&y>=h.y0&&y<=h.y1){if(!best||h.z<best.z)best=h}}return best}
function dioUnproject(sx,sy){const C=DIO.C;if(!C)return null;const k=(C.rh/2-sy)/C.F,den=C.sp-k*C.cp;if(den<=1e-4)return null;const rz=C.ch*(C.cp+k*C.sp)/den,d=C.ch*C.sp+rz*C.cp;if(d<=0)return null;const s=C.F/d;return {x:C.cx+(sx-C.rw/2)/s,z:C.cz+rz}}
function dioPick(h){if(DIO.opt.onPick)DIO.opt.onPick(h)}
function dioClick(ev){if(!DIO.ready||(DIO.opt.active&&!DIO.opt.active()))return;const h=dioHitAt(ev),st=DIO.st||{},P=DIO.pl;
 if(h&&h.k==='buddy'){if(typeof owBuddyTap==='function')owBuddyTap();return}
 if(h&&h.k==='folk'){if(typeof talkFolk!=='function'){dioSay(h.f,true);if(st.roam)dioFace(h.f);return}const f=h.f;if(st.roam){const g=dioApproach(f.x,f.z);dioWalkTo(g,()=>{P.dir=dioDirOf(f.x-P.x,f.z-P.z);talkFolk(f)})}else talkFolk(f);return}
 if(st.roam&&h&&h.go){const g=h.go;if(DIO.opt.onAim)try{DIO.opt.onAim(h)}catch(e){console.error(e)}dioWalkTo(g,()=>{if(h.look)P.dir=dioDirOf(h.look[0]-P.x,h.look[1]-P.z);dioPick(h)});return}
 if(h){dioPick(h);return}
 const [sx,sy]=dioCanvasXY(ev),g=dioUnproject(sx,sy);if(!g)return;
 if(st.roam)dioWalkTo([g.x,g.z]);else dioPick({k:'ground',x:g.x,z:g.z})}
function dioWalkTo(pt,cb){const P=DIO.pl,r=dioFind(P.x,P.z,pt[0],pt[1]);if(!r){if(cb)cb();return}P.route=r;P.ri=1;P.goal=cb||null;P.rush=1;/* v46: a walk you start goes at walking pace */DIO.tap={x:r[r.length-1][0],z:r[r.length-1][1],t:DIO.t}}
function dioDirOf(mx,mz){return Math.abs(mx)>Math.abs(mz)*1.1?(mx>0?'sideR':'side'):(mz>0?'up':'down')}
function dioFace(f){const P=DIO.pl;f.dir=dioDirOf(P.x-f.x,P.z-f.z);f.wait=Math.max(f.wait,3)}
/* keyboard: arrows or WASD while the scene is in view */
const DIO_KEYS={ArrowLeft:'l',ArrowRight:'r',ArrowUp:'u',ArrowDown:'d',a:'l',d:'r',w:'u',s:'d',A:'l',D:'r',W:'u',S:'d'};
addEventListener('keydown',ev=>{const k=DIO_KEYS[ev.key];if(!k||!DIO.cv||!DIO.ready||!DIO.st.roam||(DIO.opt.active&&!DIO.opt.active()))return;if(!(DIO.opt.keys&&DIO.opt.keys()))return;const t=ev.target;if(t&&(t.isContentEditable||/INPUT|TEXTAREA|SELECT/.test(t.tagName)))return;
 DIO.keys[k]=1;DIO.pl.route=null;DIO.pl.goal=null;ev.preventDefault()});
addEventListener('keyup',ev=>{const k=DIO_KEYS[ev.key];if(k)delete DIO.keys[k]});
addEventListener('blur',()=>{DIO.keys={}});
function dioProj(C,x,y,z){const ry=y-C.ch,rz=z-C.cz,d=-ry*C.sp+rz*C.cp;if(d<.2)return null;const v=ry*C.cp+rz*C.sp,s=C.F/d;return {x:C.rw/2+(x-C.cx)*s,y:C.rh/2-v*s,s,d}}
/* ---------- the player ---------- */
function dioPlayer(st,dt){if(DIO.pl.climb){dioClimbStep(dt);return}dioPlayer0(st,dt);dioPlayerY(dt)}
/* v28: ladders up the cliffs. A ladder prop stands at the foot of a cliff with "to" (the landing on top); tapping it
   walks you to whichever end is on your level, then you climb, hand over hand, to the other */
function dioClimbEnds(p){if(p._ce&&p._ce.id===DIO.id&&p._ce.k===DIO.gkey)return p._ce.v;const t=p.to||[p.x,p.z+.9],yt=dioH(t[0],t[1]);let top=null;
 /* the landing on top: open ground at the top's height, a little back from the edge if the edge itself is too narrow */
 for(const dz of [0,.4,.8,1.2,1.6,2.2]){for(const dx of [0,-.4,.4,-.8,.8]){const x=t[0]+dx,z=t[1]+dz;if(dioFree(x,z)&&Math.abs(dioH(x,z)-yt)<.35){top=[x,z];break}}if(top)break}
 const v={bot:dioFreePt(p.x,p.z-.5),top:top||t};Object.defineProperty(p,'_ce',{value:{id:DIO.id,k:DIO.gkey,v},writable:true,configurable:true,enumerable:false});return v}
function dioClimbGo(p){const P=DIO.pl,E=dioClimbEnds(p),y=P.yv??dioH(P.x,P.z);return Math.abs(y-dioH(E.top[0],E.top[1]))<Math.abs(y-dioH(E.bot[0],E.bot[1]))?E.top:E.bot}
function dioClimb(p){const P=DIO.pl,E=dioClimbEnds(p),yb=dioH(E.bot[0],E.bot[1]),yt=dioH(E.top[0],E.top[1]),y=P.yv??dioH(P.x,P.z),up=Math.abs(y-yb)<=Math.abs(y-yt);
 P.route=null;P.goal=null;const A=up?E.bot:E.top,Bn=up?E.top:E.bot;P.climb={a:[A[0],A[1],up?yb:yt],b:[Bn[0],Bn[1],up?yt:yb],lx:p.x,lz:p.z-.18,t:0,dur:.9+Math.abs(yt-yb)*.55,up}}
function dioClimbStep(dt){const P=DIO.pl,C=P.climb;C.t+=dt/C.dur;const k=Math.min(1,C.t),lerp=(a,b,f)=>a+(b-a)*f,s=f=>f*f*(3-2*f);
 /* onto the ladder, up (or down) it, then off at the other end */
 const k1=.15,k2=.85;let x,z,y;
 if(k<k1){const f=s(k/k1);x=lerp(C.a[0],C.lx,f);z=lerp(C.a[1],C.lz,f);y=C.a[2]}
 else if(k<k2){const f=(k-k1)/(k2-k1);x=C.lx;z=C.lz;y=lerp(C.a[2],C.b[2],f)+Math.sin(f*Math.PI*6)*.03}
 else{const f=s((k-k2)/(1-k2));x=lerp(C.lx,C.b[0],f);z=lerp(C.lz,C.b[1],f);y=C.b[2]}
 const was=Math.floor(P.climbRung||0);P.climbRung=k*8;if(Math.floor(P.climbRung)!==was&&typeof sfx==='function')sfx('step',{ter:'b'});
 P.x=x;P.z=z;P.yv=y;P.yId=DIO.id;P.walk=1;P.dir=k>=k1&&k<k2?'up':C.up?'up':'down';P.hop=null;
 if(k>=1){P.climb=null;P.x=C.b[0];P.z=C.b[1];P.yv=C.b[2];P.walk=0;P.lx=P.x;P.lz=P.z;P.ly=P.yv;if(DIO.opt.onMove)DIO.opt.onMove(P.x,P.z)}}
/* the height you are drawn at: follows the ground a step at a time, and off a ledge you hop down in a little arc */
function dioPlayerY(dt){const P=DIO.pl;if(typeof dioH!=='function')return;const gh=dioH(P.x,P.z);
 if(P.yv==null||P.yId!==DIO.id||DIO.opt.instant){P.yv=gh;P.yId=DIO.id;P.hop=null;return}
 if(!P.hop&&gh<P.yv-DIO_RISE){P.hop={t:0,h0:P.yv}}
 if(P.hop){P.hop.t+=dt/.36;const k=Math.min(1,P.hop.t);P.yv=P.hop.h0+(gh-P.hop.h0)*k*k+Math.sin(Math.PI*k)*.3;if(k>=1){P.hop=null;P.yv=gh;if(typeof sfx==='function')sfx('step',{hard:1})}}
 else P.yv+=(gh-P.yv)*Math.min(1,dt*18);
 /* lean into a climb (and back going down), seen as a tilt when you walk across the screen */
 const mv=Math.hypot(P.x-(P.lx??P.x),P.z-(P.lz??P.z));let want=0;if(mv>1e-3&&!P.hop){const g=clamp((gh-(P.ly??gh))/mv,-1,1),sx=DIO.C&&DIO.C.right?Math.sign((P.x-P.lx)*DIO.C.right[0]+(P.z-P.lz)*DIO.C.right[2]):Math.sign(P.x-P.lx);want=g*.16*sx}
 P.lean=(P.lean||0)+(want-(P.lean||0))*Math.min(1,dt*6);P.lx=P.x;P.lz=P.z;P.ly=gh}
/* v23: how the ground ahead changes your pace: up to 40% slower up a steep ramp or stairs, up to 12% quicker going down */
function dioGradeK(x,z,ux,uz){if(typeof dioGroundH!=='function')return 1;const g=(dioGroundH(x+ux*.35,z+uz*.35)-dioGroundH(x,z))/.35;if(!(Math.abs(g)<1.2))return 1;return clamp(1-g*.75,.6,1.12)}
function dioPlayer0(st,dt){const P=DIO.pl,sc=DIO.sc,mode=st.mode||'line';let mx=0,mz=0;const ox=P.x,oz=P.z;
 if(mode==='line'){const target=clamp(st.t||0,0,1);if(P.t<0||DIO.opt.instant)P.t=target;const gap=target-P.t;P.walk=Math.abs(gap)>.002;if(P.walk)P.t+=Math.sign(gap)*Math.min(Math.abs(gap),dt*.12);
  const a=dioAlong(sc,P.t);P.x=a.x;P.z=a.z;if(P.walk){mx=a.dx*Math.sign(gap);mz=a.dz*Math.sign(gap)}P.fresh=false}
 else if(mode==='path'){const key=JSON.stringify([DIO.id,st.from,st.to]);
  if(P.pk!==key){const r=dioFind(st.from[0],st.from[1],st.to[0],st.to[1])||[st.from,st.to];P.line=dioPoly(r);
   P.d=P.fresh?Math.max(0,clamp(st.t,0,1)*P.line.L-(DIO.opt.instant?0:4)):dioPolyNear(P.line,P.x,P.z);P.pk=key;P.route=null;P.goal=null;P.fresh=false}
  const tgt=clamp(st.t,0,1)*P.line.L,gap=tgt-P.d,sp=Math.max(DIO_SPEED,Math.abs(gap)*.7);
  if(Math.abs(gap)>.01){P.d+=Math.sign(gap)*Math.min(Math.abs(gap),sp*dt);P.walk=1}else P.walk=0;
  const a=dioPolyAt(P.line,P.d);P.x=a.x;P.z=a.z;mx=P.x-ox;mz=P.z-oz}
 else{/* roam; v43: on a road ('road') you roam too, pulled along to where your steps have taken you */
  if(mode!=='road'&&!P.route)P.rush=1;
  if(P.fresh){const p=dioFreePt(...(st.pos||dioHubOf(sc)));P.x=p[0];P.z=p[1];P.fresh=false;P.dir='down';P.rp=null}
  if(mode==='road'&&st.pos){const rp=P.rp;if(!rp||Math.hypot(rp[0]-st.pos[0],rp[1]-st.pos[1])>.4){P.rp=st.pos.slice();const d=Math.hypot(st.pos[0]-P.x,st.pos[1]-P.z);if(d>90){const p=dioFreePt(st.pos[0],st.pos[1]);P.x=p[0];P.z=p[1];P.route=null;P.rush=1}else if(d>.5){const r=dioFind(P.x,P.z,st.pos[0],st.pos[1]);if(r){P.route=r;P.ri=1;P.goal=null}
    /* alpha 0.2: a trip now runs through places, round their houses: a long way with no path found (a batch of steps came in at once) puts you there */else if(d>24){const p=dioFreePt(st.pos[0],st.pos[1]);P.x=p[0];P.z=p[1];P.route=null;P.rush=1}}}
   /* v46: far behind where your steps have taken you (a batch of steps arrived at once): hurry along the road instead of jumping, up to four times walking speed */
   {const d=Math.hypot(st.pos[0]-P.x,st.pos[1]-P.z);P.rush=d>8?Math.min(4,1+(d-8)/8):1}}
  else if(P.pk&&P.pk!=='roam'&&P.line&&P.d<P.line.L-.05){/* finish the walk that was under way */const L=P.line,cum=i=>i<L.seg.length?L.seg[i]:L.L;P.route=[[P.x,P.z],...L.p.filter((_,i)=>cum(i)>P.d+.01)];P.ri=1;P.goal=null}
  P.pk='roam';const K=DIO.keys,J=DIO.stick;let kx=(K.r?1:0)-(K.l?1:0),kz=(K.u?1:0)-(K.d?1:0),km=Math.hypot(kx,kz)?1:0;
  /* alpha 0.4.1: the joystick or d-pad (joystick.js): DIO.stick, screen right and up, its length how hard you push; it
     and the arrow keys walk along the camera's own right and forward, so up is always into the screen */
  if(J&&Math.hypot(J.x,J.y)>.12){kx=J.x;kz=J.y;km=Math.min(1,Math.hypot(J.x,J.y))}
  if(km){const R=DIO.C&&DIO.C.right?DIO.C.right:[1,0,0],rl=Math.hypot(R[0],R[2])||1,rx=R[0]/rl,rz=R[2]/rl,wx=kx*rx-kz*rz,wz=kx*rz+kz*rx,l=Math.hypot(wx,wz)||1;
   if(P.route){P.route=null;P.goal=null}const run=km>.92?1.3:km<.5?.6:1,s=DIO_SPEED*dt*run*dioGradeK(P.x,P.z,wx/l,wz/l);let nx=P.x+wx/l*s,nz=P.z+wz/l*s;
   if(dioStepOK(P.x,P.z,nx,P.z))P.x=nx;if(dioStepOK(P.x,P.z,P.x,nz))P.z=nz;mx=wx;mz=wz}
  else if(P.route){const tg0=P.route[P.ri],d0=Math.hypot(tg0[0]-P.x,tg0[1]-P.z)||1;let left=DIO_SPEED*(P.rush||1)*dt*dioGradeK(P.x,P.z,(tg0[0]-P.x)/d0,(tg0[1]-P.z)/d0);while(left>0&&P.route){const tg=P.route[P.ri],dx=tg[0]-P.x,dz=tg[1]-P.z,d=Math.hypot(dx,dz);
    if(d<=left){P.x=tg[0];P.z=tg[1];left-=d;mx+=dx;mz+=dz;P.ri++;if(P.ri>=P.route.length){P.route=null;const g=P.goal;P.goal=null;if(g)setTimeout(g,60)}}
    else{P.x+=dx/d*left;P.z+=dz/d*left;mx+=dx;mz+=dz;left=0}}}
  P.walk=Math.hypot(P.x-ox,P.z-oz)>1e-4?1:0;
  /* alpha 0.4.1: walking yourself, the metres you walk are your steps (14 a metre): encounters, challenges, your buddy */
  if(P.walk&&typeof walkMode==='function'&&walkMode()&&typeof addSteps==='function'&&!(typeof U!=='undefined'&&U.bench)){P.stepAcc=(P.stepAcc||0)+Math.hypot(P.x-ox,P.z-oz)*14.1;if(P.stepAcc>=300){const n=Math.floor(P.stepAcc);P.stepAcc-=n;addSteps(n,true)}}
  if(P.walk&&DIO.opt.onMove&&DIO.t-P.saved>400){P.saved=DIO.t;DIO.opt.onMove(P.x,P.z)}
  if(!P.walk&&P.wasWalk&&DIO.opt.onMove)DIO.opt.onMove(P.x,P.z)}
 if(Math.hypot(mx,mz)>1e-6)P.dir=dioDirOf(mx,mz);P.wasWalk=P.walk;
 /* grass rustle and dust */
 P.rust-=dt;if(P.walk&&P.rust<=0&&!RM){const ch=dioTer(P.x,P.z);if(ch==='t'){P.rust=.18;for(let i=0;i<3;i++)DIO.parts.push({k:'leaf',x:P.x,z:P.z,y:.3,vx:(Math.random()-.5)*1.4,vz:(Math.random()-.5)*.8,vy:1.4+Math.random(),life:0,max:.8,g:3.5,fr:i%3})}
  else if('sxk'.includes(ch)){P.rust=.3;DIO.parts.push({k:'dust',x:P.x,z:P.z-.1,y:.05,vx:(Math.random()-.5)*.4,vz:0,vy:.3,life:0,max:.6,g:0})}else P.rust=.1}}
/* ---------- townsfolk ----------
   v47: in a town everyone has a day of their own. A home (a house door), somewhere to be in the day (a shop, the
   bakery, the inn, the market, the clinic…) and a spot on the square or a bench. Out of the door in the morning and
   off to work; the square around noon; the streets in the afternoon; home at dusk, where they go in; only a night owl
   or two about late. Each keeps their own hours (a personal offset), so it doesn't all happen at once. When you come
   close they turn to look, and now and then wave and say hello. On routes and in rooms they wander as before.
   DIO.folkAll is everyone; DIO.folk is who is outside (what's drawn). */
const FOLK_WORK=/shop|clinic|lab\b|lab_|bakery|inn\b|inn_|bank|library|school|station|market|stall|cafe|mart|boutique|barn|greenhouse|windmill|office|city_hall|kiosk|ski_lodge/;
const FOLK_HOME=/house|cottage|townhouse|apartment|cave_house|chalet|villa|cabin|hut/;
function folkHour(){if(typeof envState!=='function')return 13;try{const st=envState(typeof envHere==='function'?envHere():null);return st&&st.h!=null?st.h:13}catch(e){return 13}}
/* the part of the day at hour h: in (asleep), out (off to work), work, noon (the square), about (the streets), home */
function folkPhase(h,owl){h=((h%24)+24)%24;if(h<6.5||h>=21.5)return owl?'owl':'in';return h<9?'out':h<11.5?'work':h<14?'noon':h<17.5?'about':h<20.5?'home':'in'}
function folkTown(sc){const b=sc.baseId?dioScene(sc.baseId):sc;return !!b&&!sc.indoor&&(b.kind==='town'||/^(town|city)$/.test(String(b.biome||'')))}
/* homes, places of work and places to stand about, in the town itself (not in the next place along the road) */
function dioFolkAnchors(sc){const C0=dioData().sc,PPU=C0.ppu||34,b=sc.baseId?dioScene(sc.baseId):sc,o=sc.baseOff||[0,0],hub=dioHubOf(sc);
 const inBase=p=>!b||p.x>o[0]-1&&p.z>o[1]-1&&p.x<o[0]+b.w+1&&p.z<o[1]+b.h+1,A={home:[],work:[],hang:[],stalls:[]};
 for(const p of sc.props||[]){if(!inBase(p))continue;const M=C0.props[p.k];if(!M)continue;const k=p.k+' '+(M.group||'')+' '+(p.act||'');
  if(p.days&&/stall|market_cart/.test(p.k)){if(dioPropOn(p))for(const dz of [-1.1,-1.5])A.stalls.push(dioFreePt(p.x+(Math.random()-.5)*2,p.z+dz));continue}
  if(p.act==='home')continue;
  if(M.door&&(p.act==='house'||FOLK_HOME.test(k))&&!FOLK_WORK.test(p.k))A.home.push(dioActSpot(p,M,PPU));
  else if((M.door||/stall|kiosk/.test(p.k))&&FOLK_WORK.test(k))A.work.push(dioActSpot(p,M,PPU));
  else if(/bench/.test(p.k))A.hang.push(dioFreePt(p.x,p.z-.7));
  else if(/fountain|well\b|statue|clock/.test(p.k)){for(let a=0;a<4;a++)A.hang.push(dioFreePt(p.x+Math.cos(a*1.57+.4)*2.4,p.z+Math.sin(a*1.57+.4)*1.8))}}
 for(const q of sc.npcSpots||[])if(Array.isArray(q))A.hang.push(dioFreePt(q[0],q[1]));
 if(A.hang.length<4)for(let a=0;a<6;a++)A.hang.push(dioFreePt(hub[0]+Math.cos(a*1.05)*3.2,hub[1]+Math.sin(a*1.05)*2.2));
 if(!A.work.length)A.work=A.hang.slice();if(!A.home.length)A.home=A.hang.slice();return A}
function dioFolkInit(n){const sc=DIO.sc,hub=dioHubOf(sc);DIO.folk=[];DIO.folkAll=[];DIO.folkId=DIO.id;let seed=0;for(const ch of DIO.id)seed=(seed*31+ch.charCodeAt(0))%9973;
 const town=folkTown(sc),A=town?dioFolkAnchors(sc):null,h=folkHour();
 for(let i=0;i<n;i++){const a=i*2.4+1,r=2.5+(i%3)*1.6,p=dioFreePt(hub[0]+Math.cos(a)*r,hub[1]+Math.sin(a)*r*.7);
  const f={x:p[0],z:p[1],home:p,seed:seed*10+i,dir:'down',wait:1+i*1.3,route:null,ri:0,say:null,sayT:0,walk:0,line:i,waveT:0,waved:-99};
  if(A){const pick=(L,m)=>L[Math.floor(dioHash(seed+m,i*7+m)*L.length)%L.length].slice();/* alpha 0.4: a hash, not seed+i*m (with five workplaces and m=5 everyone went to the same door) */f.A={home:pick(A.home,7),work:pick(A.work,5),hang:pick(i>=(sc.folk||0)&&A.stalls.length?A.stalls:A.hang,3)};if(i>=(sc.folk||0)&&A.stalls.length)f.A.work=f.A.hang.slice();f.off=((seed*13+i*37)%19)/10-.9;f.owl=i%6===5;
   f.ph=folkPhase(h+f.off,f.owl);const at=f.ph==='in'?null:f.ph==='out'||f.ph==='work'?f.A.work:f.ph==='noon'?f.A.hang:f.ph==='home'?f.A.home:f.ph==='owl'?[hub[0],hub[1]]:null;
   if(!at)f.in=true;else{const q=dioFreePt(at[0]+((i*.37)%1-.5)*2.4,at[1]+((i*.61)%1-.5)*1.8);f.x=q[0];f.z=q[1]}
   if(f.ph==='about'){const q=dioFolkStreet(f);f.x=q[0];f.z=q[1]}}
  DIO.folkAll.push(f)}
 DIO.folk=DIO.folkAll.filter(f=>!f.in)}
/* somewhere on the streets: another home, a place of work, the square */
function dioFolkStreet(f){const all=DIO.folkAll||[],o=all[Math.floor(Math.random()*all.length)]||f,L=o.A?[o.A.home,o.A.work,o.A.hang]:[o.home],t=L[Math.floor(Math.random()*L.length)]||[f.x,f.z];return dioFreePt(t[0]+(Math.random()-.5)*3,t[1]+(Math.random()-.5)*2)}
function dioSay(f,force){const L=typeof dioChatLines==='function'?dioChatLines(DIO_CHAT):(DIO.sc.chat&&DIO.sc.chat.length?DIO.sc.chat:DIO_CHAT);f.say=L[(f.line+(DIO.chat++))%L.length];f.sayT=force?4.2:3.2}
function dioFolkGo(f,to,then){const rt=dioFind(f.x,f.z,to[0],to[1],{noHop:true});if(rt&&rt.length>1){f.route=rt;f.ri=1;f.then=then||null;return true}f.then=null;return false}
/* hello, by the time of day */
function folkHello(){const h=folkHour();return h<11?'Morning!':h<17?'Afternoon!':h<21.5?'Evening!':'Late one, eh?'}
function dioFolkStep(dt){const P=DIO.pl,h=folkHour(),all=DIO.folkAll||DIO.folk;let vis=false;
 for(const f of all){f.sayT=Math.max(0,f.sayT-dt);f.waveT=Math.max(0,f.waveT-dt);f.walk=0;
  /* the day moves on: somewhere else to be */
  if(f.A){const ph=folkPhase(h+f.off,f.owl);if(ph!==f.ph){f.ph=ph;f.wait=Math.random()*4;
    if(f.in&&ph!=='in'){f.in=false;vis=true;const d=f.A.home;f.x=d[0];f.z=d[1];f.route=null;if(typeof sfxAt==='function')sfxAt('door',f.x,f.z)}
    if(ph==='in'||ph==='home'){f.route=null;dioFolkGo(f,f.A.home,ph==='in'||ph==='home'?'inside':null)}
    else if(ph==='out'){f.route=null;dioFolkGo(f,f.A.work)}else if(ph==='noon'){f.route=null;dioFolkGo(f,f.A.hang)}}}
  if(f.in)continue;
  if(f.route){let left=1.25*dt;while(left>0&&f.route){const tg=f.route[f.ri],dx=tg[0]-f.x,dz=tg[1]-f.z,d=Math.hypot(dx,dz);if(d>1e-6)f.dir=dioDirOf(dx,dz);
    if(d<=left){f.x=tg[0];f.z=tg[1];left-=d;f.ri++;if(f.ri>=f.route.length){f.route=null;f.wait=2+Math.random()*5;
      if(f.then==='inside'){f.then=null;f.in=true;vis=true;if(typeof sfxAt==='function')sfxAt('door',f.x,f.z)}}}else{f.x+=dx/d*left;f.z+=dz/d*left;left=0}}f.walk=f.in?0:1}
  else if((f.wait-=dt)<=0){
   if(f.A&&(f.ph==='home'||f.ph==='in')){if(!dioFolkGo(f,f.A.home,'inside')){f.in=true;vis=true}}
   else{let t;if(!f.A)t=(()=>{const a=Math.random()*6.283,r=1.5+Math.random()*4.5;return dioFreePt(f.home[0]+Math.cos(a)*r,f.home[1]+Math.sin(a)*r*.8)})();
    else if(f.ph==='about'&&Math.random()<.6)t=dioFolkStreet(f);
    else{const c=f.ph==='work'||f.ph==='out'?f.A.work:f.ph==='owl'?dioHubOf(DIO.sc):f.ph==='noon'?f.A.hang:f.A.hang,a=Math.random()*6.283,r=.6+Math.random()*(f.ph==='noon'?1.6:2.4);t=dioFreePt(c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r*.8)}
    if(!dioFolkGo(f,t))f.wait=2}}
  /* you come close: they turn to look, and now and then wave and say hello */
  const dP=Math.hypot(P.x-f.x,P.z-f.z);
  if(!f.route&&dP<2.6&&!f.sayT&&f.wait>0){dioFace(f);const now=DIO.t/1000;if(P.walk&&now-f.waved>40&&Math.random()<dt*1.2){f.waved=now;f.waveT=1.4;f.say=folkHello();f.sayT=2.4}else if(Math.random()<dt*.6)dioSay(f)}}
 if(vis)DIO.folk=all.filter(f=>!f.in);
 if(!RM&&DIO.folk.length&&Math.random()<dt/8){const f=DIO.folk[Math.floor(Math.random()*DIO.folk.length)];if(!f.sayT)dioSay(f)}}
/* v47: on market day (scene "market": {days, folk}) more people come to town, to the stalls */
function dioFolkCount(sc,n){const M=sc.market||(sc.baseId&&(dioScene(sc.baseId)||{}).market);if(!M||!M.days)return n;const T=dioClock(),h=T.h;return M.days.includes(T.day)&&h>=7&&h<18?n+(M.folk||0):n}
function dioFolkTick(n,dt){n=dioFolkCount(DIO.sc,n);if(DIO.folkId!==DIO.id||(DIO.folkAll||DIO.folk).length!==n)dioFolkInit(n);dioFolkStep(dt)}
function dioGrassImgs(C0){const out=[];for(const [k,P] of Object.entries(C0.props))if(k==='tallgrass'||(P.group==='tallgrass'&&!P.flat))out.push(P);return out.length?out:[C0.props.tallgrass].filter(Boolean)}
/* stand next to a thing, on the side you're coming from */
function dioApproach(x,z){const P=DIO.pl,dx=P.x-x,dz=P.z-z,l=Math.hypot(dx,dz)||1;return dioFreePt(x+dx/l*1.1,z+dz/l*1.1)}
function dioActSpot(p,M,PPU){const s=p.s||1,f=p.f?-1:1;if(M.door)return dioFreePt(p.x+(M.door.x||0)/PPU*s*f,p.z-.55);return dioApproach(p.x,p.z-.3)}
function dioExitMarks(C,st,t){const sc=DIO.sc,ex=sc.exits||[];if(!st.exits||!st.exits.length)return;const x=DIO.x,hub=dioHubOf(sc);x.save();x.lineCap='round';x.lineJoin='round';
 for(const e of st.exits){const pt=ex[e.i];if(!pt)continue;const dx=pt[0]-hub[0],dz=pt[1]-hub[1],l=Math.hypot(dx,dz)||1,ux=dx/l,uz=dz/l,px=-uz,pz=ux,col=e.locked?'255,120,110':e.dest?'255,212,71':'255,255,255';
  for(let c=0;c<3;c++){const f=((RM?0:t/1100)+c/3)%1,cx=pt[0]-ux*(2.2-f*1.9),cz=pt[1]-uz*(2.2-f*1.9),a=Math.sin(f*Math.PI)*.9;
   const A=dioProj(C,cx+px*.42-ux*.25,0,cz+pz*.42-uz*.25),B=dioProj(C,cx+ux*.2,0,cz+uz*.2),D=dioProj(C,cx-px*.42-ux*.25,0,cz-pz*.42-uz*.25);if(!A||!B||!D)continue;
   x.strokeStyle=`rgba(30,24,50,${a*.35})`;x.lineWidth=Math.max(3,B.s*.2);x.beginPath();x.moveTo(A.x,A.y+2);x.lineTo(B.x,B.y+2);x.lineTo(D.x,D.y+2);x.stroke();
   x.strokeStyle=`rgba(${col},${a})`;x.lineWidth=Math.max(2,B.s*.12);x.beginPath();x.moveTo(A.x,A.y);x.lineTo(B.x,B.y);x.lineTo(D.x,D.y);x.stroke()}}x.restore()}
function dioExitLabels(C,st,hits,hub){const sc=DIO.sc,ex=sc.exits||[];if(!st.exits)return;const x=DIO.x,m=Math.max(10,C.rw/40);
 for(const e of st.exits){const pt=ex[e.i];if(!pt)continue;const q=dioProj(C,pt[0],1.3,pt[1]);if(!q)continue;const dx=pt[0]-hub[0],dz=pt[1]-hub[1];
  const arrow=Math.abs(dx)>Math.abs(dz)*.8?(dx>0?'→':'←'):(dz>0?'↑':'↓'),txt=dx<0&&Math.abs(dx)>Math.abs(dz)*.8?`${arrow} ${e.name}`:`${e.name} ${arrow}`;
  const PS=dioPillSize(x,txt,e.locked?'🔒':null),w=PS.w,h=PS.h,top=Math.max(64,C.rh*.09);
  const sf=DIO.opt.safe?DIO.opt.safe():[.1,.85],lx=clamp(q.x,m+w/2,C.rw-m-w/2),ly=clamp(q.y,Math.max(top,sf[0]*C.rh)+h+4,Math.min(C.rh-m*6,sf[1]*C.rh-8));const r=dioPill(x,lx,ly,txt,e.locked?'#B54A55':e.dest?'#C99A1E':'#2E7D5B',e.locked?'🔒':null);
  hits.push({k:'exit',e,x0:r[0]-6,x1:r[2]+6,y0:r[1]-6,y1:r[3]+6,z:-1,go:dioFreePt(pt[0],pt[1])})}}
function dioTapMark(C,t){const T=DIO.tap;if(!T)return;const age=(t-T.t)/700;if(age>1||!DIO.pl.route&&age>.6){if(age>1)DIO.tap=null;return}const q=dioProj(C,T.x,0,T.z);if(!q)return;const x=DIO.x,r=q.s*(.25+age*.35);
 x.save();x.strokeStyle=`rgba(255,255,255,${(1-age)*.9})`;x.lineWidth=Math.max(2,q.s*.06);x.beginPath();x.ellipse(q.x,q.y,r,r*C.sp*.8,0,0,7);x.stroke();x.restore()}
/* v47: labels in the world in the game's pixel style: framed panels (square corners notched by one pixel, a dark
   outline, light along the top, shade along the bottom, a drop shadow) and the pixel font (Tiny5, 8 px to the em, so
   it is drawn at whole multiples of 8), all on a whole-pixel grid. Speech keeps the reading font inside a pixel frame */
function dioPx(){return Math.max(1,Math.round(dioUIpx(13)/7))}
function dioPxFont(u){return `400 ${8*u}px Tiny5, ui-monospace, monospace`}
function dioMix(c,t,k){if(typeof c!=='string'||c[0]!=='#'||c.length<7)return c;const a=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)),b=[1,3,5].map(i=>parseInt(t.slice(i,i+2),16));return '#'+a.map((v,i)=>Math.round(v+(b[i]-v)*k).toString(16).padStart(2,'0')).join('')}
function dioPanel(x,x0,y0,w,h,u,fill,hi,lo,line){x.fillStyle='rgba(20,14,36,.35)';x.fillRect(x0+u,y0+2*u,w,h);x.fillStyle=line||'#1E1830';x.fillRect(x0+u,y0,w-2*u,h);x.fillRect(x0,y0+u,w,h-2*u);
 x.fillStyle=fill;x.fillRect(x0+u,y0+u,w-2*u,h-2*u);if(hi){x.fillStyle=hi;x.fillRect(x0+2*u,y0+u,w-4*u,u)}if(lo){x.fillStyle=lo;x.fillRect(x0+2*u,y0+h-2*u,w-4*u,u)}}
/* a pixel arrow (the pixel font has no left or right arrow), 5 pixels tall, its bottom row on the baseline */
function dioPxArrow(x,x0,by,u,dir){const R=['..#..','...#.','#####','...#.','..#..'];for(let j=0;j<5;j++)for(let i=0;i<5;i++)if(R[j][dir>0?i:4-i]==='#')x.fillRect(x0+i*u,by-5*u+j*u,u,u)}
function dioPillSize(x,txt,ico){const u=dioPx();x.font=dioPxFont(u);const ar=txt.includes('→')?1:txt.includes('←')?-1:0,t=((ico?ico+' ':'')+txt.replace(/[←→]/g,'')).trim(),tw=Math.ceil(x.measureText(t).width/u)*u;
 return {u,t,tw,ar,w:tw+u*(ar?17:10),h:u*11}}
function dioPill(x,cx,cy,txt,col,ico){x.save();x.setTransform(1,0,0,1,0,0);const S=dioPillSize(x,txt,ico),u=S.u,w=S.w,h=S.h,x0=Math.round(cx-w/2),y0=Math.round(cy-h);
 dioPanel(x,x0,y0,w,h,u,col,dioMix(col,'#FFFFFF',.3),dioMix(col,'#000000',.28));x.fillStyle='#FFFFFF';x.textAlign='left';x.textBaseline='alphabetic';
 const by=y0+u*8;let tx=x0+u*5;if(S.ar<0){dioPxArrow(x,tx,by,u,-1);tx+=u*7}x.fillText(S.t,tx,by);if(S.ar>0)dioPxArrow(x,tx+S.tw+u*2,by,u,1);x.restore();return [x0,y0,x0+w,y0+h]}
function dioPxTail(x,cx,y,u,fill,line){x.fillStyle=line;x.fillRect(cx-3*u,y,6*u,u);x.fillRect(cx-2*u,y+u,4*u,u);x.fillRect(cx-u,y+2*u,2*u,u);x.fillStyle=fill;x.fillRect(cx-2*u,y-u,4*u,u);x.fillRect(cx-u,y,2*u,u)}
function dioSpeech(x,cx,cy,txt,a){if(!txt)return;const s=dioUIpx(12),u=dioPx();x.save();x.globalAlpha=a;x.font=`500 ${s}px Chakra Petch, system-ui, sans-serif`;
 const maxW=Math.min(DIO.cv.width*.5,s*16),words=txt.split(' '),lines=[];let cur='';for(const w of words){const n=cur?cur+' '+w:w;if(x.measureText(n).width>maxW&&cur){lines.push(cur);cur=w}else cur=n}if(cur)lines.push(cur);
 const w=Math.ceil((Math.max(...lines.map(l=>x.measureText(l).width))+s*1.2)/u)*u,h=Math.ceil((lines.length*s*1.25+s*.8)/u)*u,x0=Math.round(clamp(cx-w/2,6,DIO.cv.width-w-6)),y0=Math.round(Math.max(6,cy-h-4*u)),tc=Math.round(clamp(cx,x0+4*u,x0+w-4*u));
 dioPanel(x,x0,y0,w,h,u,'#FFFDF4','#FFFFFF','#EDE6D6','#2A2238');dioPxTail(x,tc,y0+h-u,u,'#FFFDF4','#2A2238');
 x.fillStyle='#2A2238';x.textAlign='left';x.textBaseline='top';lines.forEach((l,i)=>x.fillText(l,x0+s*.6,y0+s*.45+i*s*1.25));x.restore()}
function dioBubble(x,cx,cy,txt,col){x.save();x.setTransform(1,0,0,1,0,0);const u=dioPx(),b=Math.round(Math.abs(Math.sin(DIO.t/300))*3/u)*u,w=u*9,h=u*11,x0=Math.round(cx-w/2),y0=Math.round(cy-h-3*u-b);
 dioPanel(x,x0,y0,w,h,u,'#FFFDF4','#FFFFFF','#EDE6D6','#2A2238');dioPxTail(x,Math.round(cx),y0+h-u,u,'#FFFDF4','#2A2238');x.fillStyle=col;x.font=dioPxFont(u);x.textAlign='center';x.textBaseline='alphabetic';x.fillText(txt,x0+w/2,y0+u*8);x.restore()}
function dioTag(x,cx,cy,e){const u=dioPx(),txt=`Lv ${e.lvl}`;x.save();x.font=dioPxFont(u);const tw=Math.ceil(x.measureText(txt).width/u)*u,qw=Math.ceil(x.measureText('?').width/u)*u,w=tw+qw+u*12,h=u*11,x0=Math.round(cx-w/2),y0=Math.round(cy-h-2*u);
 dioPanel(x,x0,y0,w,h,u,'#251C3E','#3A2E5C','#18122A','#0E0A18');dioPxTail(x,Math.round(cx),y0+h-u,u,'#251C3E','#0E0A18');
 x.textAlign='left';x.textBaseline='alphabetic';x.fillStyle='#FFE27A';x.fillText('?',x0+u*5,y0+u*8);x.fillStyle='#FFFFFF';x.fillText(txt,x0+u*7+qw,y0+u*8);x.restore()}
