'use strict';
/* ================= WALK SHADERS =================
   Phase 20 (stage B): the walk scene's shader programs, moved from walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { COMMON_GLSL, LIGHT_GLSL, LOOK_GLSL } from '../engine/webgl.js';
/* eslint-disable no-func-assign */
expose({
  FALL_GLSL: [() => FALL_GLSL],
  PIXEL_WATER_GLSL: [() => PIXEL_WATER_GLSL],
  RING_AT_GLSL: [() => RING_AT_GLSL],
  ROCK_GLSL: [() => ROCK_GLSL],
  SPRITE_INSTANCE_DEFINES: [() => SPRITE_INSTANCE_DEFINES],
  SPRITE_INSTANCE_SHADERS: [() => SPRITE_INSTANCE_SHADERS],
  SPRITE_INSTANCE_VARYINGS: [() => SPRITE_INSTANCE_VARYINGS],
  SPRITE_INSTANCE_VS: [() => SPRITE_INSTANCE_VS],
  TIDE_GLSL: [() => TIDE_GLSL],
  WALK_SHADERS: [() => WALK_SHADERS],
  spriteInstanceFragment: [() => spriteInstanceFragment, v => (spriteInstanceFragment = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* ---------- shaders ---------- */
/* terrain TR-3: rock between the camera and you thins out: a spot nearer the camera than you, half a metre above your
   feet, in a soft circle round you on screen, is dropped by a dither (draw-common.js setRockUniforms sets these).
   Player visibility: its dither is the fades' pattern moved by (2, 1) pixels, so a picture that is both faded (it
   keeps the low cells) and in the circle (it drops the low cells) always keeps a few pixels: at least 2 in 16 for any
   fade from 0.1 and circle up to 0.85. With the same pattern the two together dropped every pixel, the silhouette's
   occlusion query saw nothing in front of you and the circle went off again */
export const ROCK_GLSL = `uniform mat4 uVP;uniform vec3 uPlC;uniform vec4 uRock;uniform float uAspect;
float rockBay(vec2 p){ivec2 i=ivec2(mod(p,4.));int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i.y*4+i.x])+.5)/16.;}
float rockCut(vec3 w){if(uRock.y<=0.||w.y<uRock.x+.5)return 0.;vec4 c=uVP*vec4(w,1.);if(c.w>=uPlC.z-.6)return 0.;vec2 nd=c.xy/c.w;
 return (1.-smoothstep(uRock.y*.55,uRock.y,length((nd-uPlC.xy)*vec2(uAspect,1.))))*uRock.z;}
bool rockHides(vec3 w){return rockBay(gl_FragCoord.xy+vec2(2.,1.))<rockCut(w);}
`;
/* water track WA-1: the pixel water, shared by the water, its shore, the falls and (lane B) the world map's and battles'
   water. uPixW: on, tones a kind (water.bands), animation steps a second (water.frames). On, water lies on the
   ground's 32 texels a metre grid, a kind's colours fall in a few tones with an ordered dither fixed to that grid (it
   does not swim as the camera moves), and the small motions step; off, the 16 grid and smooth tones of before. */
export const PIXEL_WATER_GLSL = `uniform vec3 uPixW;
float pwRes(){return uPixW.x>.5?32.:16.;}
vec2 pwCell(vec2 xz){return floor(xz*pwRes());}
vec2 pwSnap(vec2 xz){return floor(xz*pwRes())/pwRes();}
float pwBayer(vec2 c){ivec2 i=ivec2(mod(c,4.));int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i.y*4+i.x])+.5)/16.;}
float pwStep(float t){return uPixW.x>.5&&uPixW.z>0.?floor(t*uPixW.z)/uPixW.z:t;}
float pwQ(float v,float n,vec2 c){if(uPixW.x<.5)return v;n=max(n,2.)-1.;return clamp(floor(clamp(v,0.,1.)*n+pwBayer(c)),0.,n)/n;}
float pwBand(float v,vec2 c){return pwQ(v,uPixW.y,c);}
vec3 pwTone(vec3 shal,vec3 deep,float d,vec2 c){return mix(shal,deep,pwBand(d,c));}
float pwHard(float e0,float e1,float x){return uPixW.x>.5?step((e0+e1)*.5,x):smoothstep(e0,e1,x);}
`;
/* water track WA-4: the sea's tide and storm (walk/water-data.js setShoreUniforms): uTide.x the tide (1 high ... -1 low),
   y the storm (0-1), z whether the shore texture has the tide's lines (green the high water's, blue the low water's;
   walk/sea-tide.js). tideSF gives the shoreline value with the tide in: the waterline moves between them */
const TIDE_GLSL = `uniform vec4 uTide;
float tideSF(vec4 s){return uTide.z>.5?mix(s.r,uTide.x>0.?s.g:s.b,abs(uTide.x)):s.r;}
`;
/* water track WA-2a: the scene's nearest waterfalls (walk/water-data.js setFallUniforms: up to 4, nearest you first):
   uFallA (the lip's x, z and the way it falls), uFallB (width, drop, plunge pool's radius, the lip's height). fallReach
   is how far out the sheet lands (as ground-mesh.js placeFalls); fallNear gives, at a point, how wet the rock and
   ground beside and below a fall are (x) and how much of the white water's light reaches it (y) */
const FALL_GLSL = `uniform vec4 uFallA[4],uFallB[4];uniform int uFallN;
float fallReach(float h){return min(1.8,.25+.45*sqrt(h));}
vec2 fallNear(vec3 p){vec2 r=vec2(0.);for(int i=0;i<4;i++){if(i>=uFallN)break;vec4 A=uFallA[i],B=uFallB[i];vec2 d=A.zw,q=p.xz-A.xy;float rc=fallReach(B.y),al=dot(q,d),la=abs(dot(q,vec2(-d.y,d.x)));
 if(al<-1.6||al>rc+B.z+2.5||la>B.x*.5+B.z+2.5||p.y>B.w+.3||p.y<B.w-B.y-1.)continue;
 float wet=(1.-smoothstep(B.x*.5+.1,B.x*.5+.5+B.y*.08,la))*(1.-smoothstep(rc+.2,rc+1.2,al))*smoothstep(-1.4,-.4,al)*step(p.y,B.w+.04);
 vec2 f=q-d*rc;float df=length(vec2(dot(f,d),max(abs(dot(f,vec2(-d.y,d.x)))-B.x*.5,0.)));
 float lt=(1.-smoothstep(.2,max(B.z*.6,.8)+1.2,df))*(1.-smoothstep(0.,1.5+B.y*.3,p.y-(B.w-B.y)))*clamp(B.y/4.,.35,1.);r=max(r,vec2(wet,lt));}return r;}
`;
/* v46: the near ring lookup, shared by the ground and the grass (their uniforms: uRingC, uRingBox, uCanvas) */
const RING_AT_GLSL = `float ringAt(vec2 cc,out vec2 ruv){ruv=vec2(0.);if(uCanvas.z<.5)return 0.;vec2 ch=floor(cc/16.),s=mod(ch,4.);int si=int(s.x+.5)+int(s.y+.5)*4;vec2 h=uRingC[si];if(abs(h.x-ch.x)>.5||abs(h.y-ch.y)>.5)return 0.;
 ruv=(s*16.+(cc-ch*16.))/64.;vec2 e=min(cc-uRingBox.xy,uRingBox.zw-cc);return clamp(min(e.x,e.y)/3.,0.,1.);}`;
export const WALK_SHADERS = {
  ground: [
    `#version 300 es
precision highp float;in vec3 aPos;in vec3 aNrm;layout(location=2) in vec3 aWall;uniform mat4 uVP;uniform vec3 uOrg;out vec3 vW;out vec3 vN;out vec3 vWall;out vec4 vClip;${COMMON_GLSL}
void main(){vec3 p=aPos+uOrg;p.y+=curveY(p.xz);vW=p;vN=aNrm;vWall=aWall;gl_Position=uVP*vec4(p,1.);vClip=gl_Position;}`,
    `#version 300 es
precision highp float;in vec3 vW;in vec3 vN;in vec3 vWall;in vec4 vClip;out vec4 o;uniform sampler2D uGround,uFar,uCliff,uGNrm,uWallA;uniform vec4 uGRect;uniform vec3 uFarTint;uniform float uGStr,uGShine,uWallDef;uniform vec3 uWallCol[12];uniform sampler2D uShore;uniform vec3 uShoreR,uBed;uniform vec4 uSea;uniform vec4 uRoom;uniform vec4 uRoomT;uniform float uRoomY;uniform sampler2D uGAO;uniform vec3 uGAOR,uSkyW;uniform float uWet,uRainK,uCausW;uniform vec3 uWGlow;uniform sampler2D uRing,uRingN;uniform vec2 uRingC[16];uniform vec4 uRingBox;uniform vec3 uCanvas;uniform vec4 uHole;${LIGHT_GLSL}${ROCK_GLSL}${PIXEL_WATER_GLSL}${FALL_GLSL}${TIDE_GLSL}
/* v46: the near ring: the 16 m squares round you at full size (4 x 4 of them in one texture, each in the slot its
   position mod 4 gives); the view's whole ground is the small distant picture. 0 = not in the ring */
${RING_AT_GLSL}
vec3 rampW(vec3 b,float t){vec3 d0=mix(b*.55,vec3(.235,.165,.439),.30),d1=mix(b*.79,vec3(.376,.29,.596),.17),l3=mix(b,vec3(1.,.957,.769),.30),l4=mix(b,vec3(1.,.988,.918),.60);return t<.5?d0:t<1.5?d1:t<2.5?b:t<3.5?l3:l4;}
float bayerG(vec2 p){ivec2 i=ivec2(mod(p,4.));int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i.y*4+i.x])+.5)/16.;}
/* IS-5: a room turned with its door (logic/room-turn.js): the place's metres in the room's own (uRoomT: the turn's point, cos, sin; cos 1 for a room facing south) */
vec2 roomOwn(vec2 w){if(uRoomT.z>.999)return w;vec2 d=w-uRoomT.xy;return uRoomT.xy+vec2(d.x*uRoomT.z+d.y*uRoomT.w,-d.x*uRoomT.w+d.y*uRoomT.z);}
vec2 roomOwnDir(vec2 v){return vec2(v.x*uRoomT.z+v.y*uRoomT.w,-v.x*uRoomT.w+v.y*uRoomT.z);}
void main(){/* phase 08b: a room drawn over the place: the place's ground leaves a hole there */if(vW.x>uHole.x&&vW.x<uHole.z&&vW.z>uHole.y&&vW.z<uHole.w)discard;
 vec3 n=normalize(vN);vec2 rcc=vec2((vW.x-uGRect.x)*uGRect.z,(uGRect.y-vW.z)*uGRect.w)*uCanvas.xy,rdx=dFdx(rcc)/64.,rdy=dFdy(rcc)/64.;vec2 ruv;float rw=ringAt(rcc,ruv);
 if(vWall.z>0.){/* a wall: between the camera and you it thins out so you stay in view */vec2 nd=vClip.xy/vClip.w;float wc=vClip.w<uPlC.z-.6&&length((nd-uPlC.xy)*vec2(uAspect,1.))<.26?.62:0.;if(bayerG(gl_FragCoord.xy)<max(wc,rockCut(vW)))discard;
  int m=int((vWall.x<.5?uWallDef:vWall.x)+.5);m=clamp(m,0,11);vec2 tc=abs(n.x)>abs(n.z)?vec2(vW.z,-vW.y):vec2(vW.x,-vW.y);vec2 gg=tc*.5,cell=vec2(float(m%4),float(m/4));
  vec2 aa=(cell+fract(gg))/vec2(4.,3.);float lv=textureGrad(uWallA,aa,dFdx(gg)/vec2(4.,3.),dFdy(gg)/vec2(4.,3.)).r*4.;vec3 a=rampW(uWallCol[m],floor(lv+.5));
  float hy=vWall.y*vWall.z,top=vWall.z-hy;a*=(top<.06?1.22:1.)*mix(.7,1.,clamp(hy/.7,0.,1.));
  /* v31: a room's walls: a skirting board along the floor, a little darker toward the corners */
  if(uRoom.w>.5&&m==10){if(hy<.18){a=vec3(.6,.4,.26)*(hy>.158?1.7:hy>.142?.62:hy<.02?.7:1.15)*(.93+.07*fract(sin(floor(tc.x*1.5)*91.7)*437.5));}else if(hy<.22)a*=.8;vec2 rl=roomOwn(vW.xz);float cd=min(abs(rl.x-uRoom.x),abs(rl.x-uRoom.y));a*=mix(.8,1.,smoothstep(0.,.9,cd));
   /* v47: a corner trim where the back wall meets a side wall: a plain wooden post at wall height closes the joint */
   float dc=abs(roomOwnDir(n.xz).x)>.5?abs(uRoom.z-rl.y):cd;if(dc<.07&&top>.005)a=vec3(.6,.4,.26)*(dc>.055?.62:dc<.02?1.28:1.08)*(top<.04?1.2:1.);}
  if((m<4||m==9)&&vWall.z>.3){float u=floor(tc.x*16.)/16.,rag=.09+.12*fract(sin(u*127.1)*43758.5)+.04*sin(u*4.7);vec2 gt=vec2((vW.x-n.x*.14-uGRect.x)*uGRect.z,(uGRect.y-(vW.z-n.z*.14))*uGRect.w);
   if(top<rag)a=texture(uGround,gt).rgb*(top>rag-.03?.78:1.);else if(top<rag+.05)a*=.62;}
  /* scree: pebbles fallen at the foot */
  if((m<4||m==9)&&hy<.12){float sp=fract(sin(dot(floor(vec2(tc.x,hy)*16.),vec2(12.9898,78.233)))*43758.5);if(sp>.72)a=mix(a,vec3(.62,.58,.52)*(.8+.4*sp),.6);}
  /* water track WA-2a: rock beside a waterfall and under its lip is dark and wet, with trickles stepping down it in pixel columns */
  vec2 fn=uFallN>0?fallNear(vW):vec2(0.);float fw=pwQ(fn.x,3.,pwCell(vec2(tc.x,vW.y)));if(fw>0.){a*=1.-.42*fw;a=mix(a,a*vec3(.86,.93,1.05),fw);}
  float sh=shadowAtN(vW+n*.04,n,.0012),ao=mix(contactAO(vW),1.,clamp(hy/.6,0.,1.));if(uRoom.w>.5&&m==10)ao=mix(ao,1.,.6);vec3 lit=shade(a,n,vW,sh,ao,vec4(fw*.5,24.,0.,.25),0.);
  if(fw>0.||fn.y>0.){float pr=pwRes(),cx=floor(tc.x*pr),t=pwStep(uTime*.001),hc=fract(sin(cx*91.7)*437.58);
   lit+=(uSunCol*.5+uAmbTop*.5)*fw*step(.8,hc)*step(fract(vW.y*1.1+t*(1.+hc)+hc*7.),.22)*.35;
   /* the white water's light thrown up on the rock: a stepped shimmer, stronger at night */
   float k=sin(cx/pr*5.1+t*1.6+sin(floor(vW.y*pr)/pr*3.7-t)*1.4)+sin(cx/pr*3.3-t*1.1+floor(vW.y*pr)/pr*4.2);lit+=vec3(.82,.9,1.)*pwQ(fn.y*(.45+.55*pow(clamp(1.-abs(k)*.5,0.,1.),3.)),3.,vec2(cx,floor(vW.y*pr)))*(.05+.3*(1.-uAmbK));}
  /* v32: sunlight thrown up off water in front of a wall: thin wandering bright lines near its foot (WA-5b: and a glowing water's own light, uWGlow) */
  vec3 caw=vec3(0.);if(uShoreR.z>.5&&uCausW>0.){vec2 su=(vW.xz+n.xz*.7)*uShoreR.xy;if(su.x>0.&&su.y>0.&&su.x<1.&&su.y<1.){float sf=texture(uShore,su).r;if(sf>.5){float pr=pwRes();vec2 q=floor(vec2(dot(vW.xz,vec2(n.z,-n.x)),vW.y)*pr)/pr;float t=pwStep(uTime*.001);
   float k=sin(q.x*5.1+t*1.3+sin(q.y*3.7-t)*1.4)+sin(q.x*3.3-t*.9+q.y*4.2);float cl=pwQ(pow(clamp(1.-abs(k)*.55,0.,1.),6.),3.,q*pr);caw=(uSunCol*.35*sh+uWGlow*.5)*cl*uCausW*smoothstep(.5,.66,sf)*(1.-smoothstep(.2,1.8,hy));}}}
  o=vec4(fogit(lit+caw,vW),0.);return;}
 /* terrain TR-3: the ground (smooth slopes too) thins out where it stands between the camera and you */
 if(rockHides(vW))discard;
 /* v31: in a room, past the front edge: the floor boards' cut edge, then the dark under the floor */
 if(uRoom.w>.5&&vW.z<-.001){float d=uRoomY-vW.y;vec3 sec=d<.07?vec3(.42,.3,.2)*(d<.015?1.25:1.):d<.13?vec3(.16,.12,.1):mix(vec3(.1,.08,.09),vec3(.02,.02,.03),smoothstep(.13,1.4,d));o=vec4(fogit(sec,vW),0.);return;}
 vec2 g=vec2((vW.x-uGRect.x)*uGRect.z,(uGRect.y-vW.z)*uGRect.w);vec3 a;float spec=0.;float st=1.-n.y,c=smoothstep(.28,.5,st);
 if(g.x>0.&&g.y>0.&&g.x<1.&&g.y<1.){a=texture(uGround,g).rgb;if(rw>0.)a=mix(a,textureGrad(uRing,ruv,rdx,rdy).rgb,rw);/* v24: snow reads white, not grey */{float lm=dot(a,vec3(.3,.59,.11));a*=1.+.3*smoothstep(.74,.9,lm)*clamp(1.-abs(a.r-a.b)*4.,0.,1.);}vec4 gm=texture(uGNrm,g);if(rw>0.)gm=mix(gm,textureGrad(uRingN,ruv,rdx,rdy),rw);n=normalize(n+vec3(gm.r*2.-1.,0.,gm.g*2.-1.)*uGStr*(1.-c));spec=gm.a;
  /* v31: the shore: water tile art becomes a sandy-muddy bed, and a wet rim darkens the bank along the curved edge */
  if(uRoom.w>.5){vec2 rl=roomOwn(vW.xz);float dw=min(min(rl.x-uRoom.x,uRoom.y-rl.x),uRoom.z-rl.y);a*=mix(.7,1.,smoothstep(0.,.75,dw));}
  if(uShoreR.z>.5){vec2 su=(pwSnap(vW.xz)+.5/pwRes())*uShoreR.xy;if(su.x>0.&&su.y>0.&&su.x<1.&&su.y<1.){vec4 s4=texture(uShore,su);float sf=s4.r,sft=tideSF(s4);
   float blu=smoothstep(.02,.1,a.b-max(a.r,a.g)*.9)*step(.12,sf);vec3 bed=uBed*(.82+.3*lnoise(pwSnap(vW.xz)*3.36))*mix(1.,.7,smoothstep(.55,.9,sf));
   /* v47: pebbles on the bed, one to a cell of an eighth of a metre (most cells), lit on their far side, on the pixel grid */
   {vec2 pq=(floor(vW.xz*32.)+.5)/32.*8.,pc=floor(pq),pf=fract(pq);vec3 ph=fract(sin(vec3(dot(pc,vec2(127.1,311.7)),dot(pc,vec2(269.5,183.3)),dot(pc,vec2(419.2,371.9))))*43758.55);
    vec2 pd=pf-(.3+ph.xy*.4);float pr=.16+ph.z*.17;if(ph.z>.28&&length(pd*vec2(1.,1.25))<pr){bed=mix(bed,vec3(.6,.58,.54)*(.7+.5*ph.x),.55)*(pd.y>pr*.25?1.18:pd.y<-pr*.4?.82:1.);}}a=mix(a,bed,max(blu,smoothstep(.5,.75,sf)*.65));
   float wet=smoothstep(.2,.46,max(sf,sft));
   /* water track WA-4: below the high water's line the sand stays wet, drying as the tide goes out; the bed the low tide leaves is wet and shiny */
   if(uTide.z>.5){wet=max(wet,smoothstep(.3,.5,s4.g)*(.45+.2*(uTide.x+1.)));}
   /* IS-3: on a sea coast the sand is wet further up, and darkest just above the line as the swash runs up and back (the water shader's lap) */
   if(uSea.z>.5){float sw=.5+.5*sin(uTime*.00085+dot(pwSnap(vW.xz),vec2(.21,.17)));wet=max(wet,smoothstep(.02,.3,sft)*.7);wet=max(wet,smoothstep(.4-.16*sw,.47,sft));}/* water track WA-1: the wet rim in a few tones on the pixel grid */wet=pwQ(wet,3.,pwCell(vW.xz));a*=1.-.26*wet;a=mix(a,a*vec3(.9,.95,1.04),wet*.5);spec=max(spec,wet*(1.-smoothstep(.5,.6,sft))*.55);n=normalize(mix(n,vec3(0.,1.,0.),wet*.6));}}}
 else a=texture(uFar,vW.xz).rgb*uFarTint*(.82+.36*lnoise(vW.xz*.11))*(.9+.2*lnoise(vW.xz*.37+7.));
 /* v32: after rain the ground is darker and a little shiny, with puddles on level paths and paving that mirror the sky */
 float pud=0.;if(uWet>0.&&g.x>0.&&g.y>0.&&g.x<1.&&g.y<1.){float grs=smoothstep(.015,.07,a.g-max(a.r,a.b));a*=1.-uWet*(.2-grs*.08);spec=max(spec,uWet*(1.-grs)*.45);
  vec2 pq=pwSnap(vW.xz);pud=smoothstep(.56,.72,lnoise(pq*.38+3.1)*.75+lnoise(pq*1.4+7.)*.3)*uWet*smoothstep(.985,.997,normalize(vN).y)*(1.-grs)*(1.-c);}
 a=snowOn(seasonal(a,vW),vW,normalize(vN).y);
if(c>0.){vec3 cx=texture(uCliff,vec2(vW.z,-vW.y)*.9).rgb,cz=texture(uCliff,vec2(vW.x,-vW.y)*.9).rgb;vec3 cl=mix(cz,cx,abs(n.x)/(abs(n.x)+abs(n.z)+.001));a=mix(a,cl*(.78+.2*n.y),c);}
 float bias=.0008+.0025*(1.-max(dot(n,uSunDir),0.));float sh=shadowAtN(vW+n*.03,n,bias);float ao=contactAO(vW);float occ=min(sh,ao);
 /* v32: soft shade baked in round the feet of trees, buildings, rocks and walls */
 float gao=1.;if(uGAOR.z>0.){vec2 gu=vW.xz*uGAOR.xy;if(gu.x>0.&&gu.y>0.&&gu.x<1.&&gu.y<1.)gao=mix(1.,texture(uGAO,gu).r,uGAOR.z);}
 if(pud>0.){vec3 vv=normalize(uEye-vW);float fr=.35+.6*pow(1.-max(vv.y,0.),3.);float rr=0.;if(uRainK>0.){vec2 cq=pwSnap(vW.xz)*2.2,ci=floor(cq),cf=fract(cq)-.5;float ph=fract(pwStep(uTime*.001)*1.1+fract(sin(dot(ci,vec2(12.9,78.2)))*437.5));rr=(1.-smoothstep(0.,.06,abs(length(cf)-ph*.5)))*(1.-ph)*uRainK;}
  float rim=smoothstep(.15,.4,pud)*(1.-smoothstep(.45,.75,pud));a=mix(a,mix(a*.3,uSkyW*1.3+.04,fr*.85)+rr*.3,smoothstep(.35,.7,pud)*.9);a*=1.-rim*.35;n=normalize(mix(n,vec3(0.,1.,0.),pud));spec=max(spec,pud*1.6);}
 /* water track WA-2a: the ground round a waterfall's foot is wet from its spray, and lit by its white water */
 vec2 fn=uFallN>0?fallNear(vW):vec2(0.);float fw=pwQ(fn.x,3.,pwCell(vW.xz));if(fw>0.){a*=1.-.3*fw;spec=max(spec,fw*.6);}
 vec3 lit=shade(a*mix(1.,gao,.35),n,vW,sh,mix(1.,ao,.7)*gao,vec4(spec*uGShine*.9,24.,0.,0.),0.);
 if(fn.y>0.){vec2 q=pwSnap(vW.xz);float t=pwStep(uTime*.001),k=sin(q.x*5.1+t*1.6+sin(q.y*3.7-t)*1.4)+sin(q.x*3.3-t*1.1+q.y*4.2);
  lit+=vec3(.82,.9,1.)*pwQ(fn.y*(.4+.6*pow(clamp(1.-abs(k)*.5,0.,1.),3.)),3.,pwCell(vW.xz))*(.035+.25*(1.-uAmbK));}
 /* v47: alpha 0 marks the ground for the post pass: no ink outlines on it */o=vec4(fogit(lit,vW),0.);}`,
  ],
  sprite: [
    `#version 300 es
precision highp float;in vec2 aC;uniform mat4 uVP;uniform vec3 uBase,uRight;uniform vec4 uOff;uniform vec4 uUV;uniform float uFlip,uShear,uCurveOn,uDZ,uSlope;uniform vec3 uFwd,uWave;uniform vec4 uGhostV;out vec2 vUV;out vec3 vW;out float vH;out float vPx;out float vRip;${COMMON_GLSL}
void main(){vRip=0.;float px=(uOff.x+aC.x*uOff.z),py=(uOff.y+aC.y*uOff.w);float h=-py;float fh=clamp(h/max(.01,-uOff.y),0.,1.),sh=uShear*h*(.25+.75*fh);/* v43: the bend grows toward the top, like a stem */vec3 p=uBase+uFwd*uDZ+uRight*(px*uFlip+sh)+vec3(0.,h+uSlope*px*uFlip-abs(sh)*.35*fh,0.);
 /* v43: a flag: cloth that ripples from the hoist (aC.x = 0) to the free end, lifting, dipping and trailing in the wind */
 if(uWave.x>0.){float ph=aC.x*6.5-uWave.y,a=uWave.x*aC.x;p+=vec3(0.,sin(ph+.8)*a*.45,0.)+uRight*(-(aC.x*aC.x)*uWave.x*.35*(.5+.5*sin(ph-1.2)))*uFlip+uFwd*sin(ph)*a*.5;vRip=cos(ph)*a*2.2;}
 p.y+=curveY(uBase.xz)*uCurveOn;vW=p;vPx=px*uFlip+sh;vH=clamp(h/max(.01,-uOff.y),0.,1.);vUV=vec2(uUV.x+aC.x*uUV.z,uUV.y+aC.y*uUV.w);
 /* terrain TR-3: your silhouette is drawn pulled toward the eye along each corner's own line of sight (so it covers
    the same pixels), so only rock clearly nearer than you shows it, not the ground at your feet */
 if(uGhostV.w>0.)p+=normalize(uGhostV.xyz-p)*uGhostV.w;gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;in vec3 vW;in float vH;in float vPx;in float vRip;out vec4 o;uniform sampler2D uTex,uNrm;uniform vec3 uRight,uBack,uSunH,uBaseP;uniform float uFade,uRim,uLit,uAlpha,uShade,uEmit,uFlipN,uFixed,uSelOut,uNoRecv;uniform vec4 uMat,uUV;uniform vec3 uSelf;uniform vec4 uGhost;uniform float uGhostE;${LIGHT_GLSL}${LOOK_GLSL}${ROCK_GLSL}
float bayer(vec2 p){ivec2 i=ivec2(mod(p,4.));int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i.y*4+i.x])+.5)/16.;}
void main(){vec4 c=texture(uTex,vUV);if(c.a<.5)discard;
 /* terrain TR-3: your silhouette through rock: a flat tint (uGhost.rgb) over uGhost.w of the pixels; player visibility:
    with uGhostE (art pixels) the picture's edge is drawn whole, uGhost.w is then the inside's share */
 if(uGhost.w>0.){bool e=false;if(uGhostE>0.){vec2 ts=uGhostE/vec2(textureSize(uTex,0)),lo=min(uUV.xy,uUV.xy+uUV.zw),hi=max(uUV.xy,uUV.xy+uUV.zw);
  for(int i=0;i<4;i++){vec2 u=vUV+ts*(i==0?vec2(1.,0.):i==1?vec2(-1.,0.):i==2?vec2(0.,1.):vec2(0.,-1.));if(any(lessThan(u,lo))||any(greaterThan(u,hi))||textureLod(uTex,u,0.).a<.5)e=true;}}
  if(!e&&bayer(gl_FragCoord.xy)>uGhost.w)discard;o=vec4(uGhost.rgb,uAlpha);return;}
 if(uFade<.99&&bayer(gl_FragCoord.xy)>uFade)discard;if(rockHides(vW))discard;
 /* v47: one outline rule: a near-black texel on the picture's edge takes a deep shade of the colour beside it, so
    outlines are coloured, as the newer art draws them (the pictures themselves are not changed) */
 if(uSelOut>0.&&dot(c.rgb,vec3(.3,.59,.11))<.17){vec2 ts=1./vec2(textureSize(uTex,0));vec4 q[4]=vec4[4](texture(uTex,vUV+vec2(ts.x,0.)),texture(uTex,vUV-vec2(ts.x,0.)),texture(uTex,vUV+vec2(0.,ts.y)),texture(uTex,vUV-vec2(0.,ts.y)));
  float ed=0.,n=0.;vec3 s=vec3(0.);for(int i=0;i<4;i++){if(q[i].a<.5)ed+=1.;else if(dot(q[i].rgb,vec3(.3,.59,.11))>=.17){s+=q[i].rgb;n+=1.;}}
  if(ed>0.&&n>0.)c.rgb=mix(c.rgb,s/n*vec3(.5,.45,.56),uSelOut);}
 vec3 nn=texture(uNrm,vUV).xyz*2.-1.;vec3 n=normalize(uRight*nn.x*uFlipN+vec3(0.,-nn.y,0.)+uBack*max(nn.z,.2));c.rgb=lookOn(c.rgb,floor(vUV*vec2(textureSize(uTex,0))),vH,uBaseP);c.rgb=snowOn(seasonal(c.rgb,uBaseP),vW,n.y);
 /* shadows from other things. A picture that stays put in the world is itself in the shadow map, so it is looked up
    just in front of its own plane; one that turns to face the camera is looked up a little toward the sun instead */
 vec3 sp=uFixed>.5?vW+uBack*.06+vec3(0.,.03,0.):vW+uSunH*(abs(vPx)*.9+.35)+vec3(0.,.05,0.);
 float sh=uNoRecv>.5?1.:shadowAt(sp,uFixed>.5?.0009:.0015);
 /* alpha 0.4.1: a tree shades itself. From each texel a short march toward the sun across its own picture: leaves
    above (or beside, when the sun is low) put the trunk and the lower and inner leaves in shade, the crown stays lit */
 if(uSelf.x>0.){vec2 tz=vec2(textureSize(uTex,0)),d=uSelf.yz*uUV.w*tz.y*.045/tz;vec2 q=vUV+d*1.5;float hit=0.,wt=0.;
  for(int i=0;i<10;i++){q+=d;if(q.x<uUV.x||q.y<uUV.y||q.x>uUV.x+uUV.z||q.y>uUV.y+uUV.w)break;float w=1.-float(i)*.05;hit+=step(.5,texture(uTex,q).a)*w;wt+=w;}
  sh=min(sh,1.-uSelf.x*smoothstep(1.2,4.2,hit));}float ao=mix(contactAO(uBaseP),1.,clamp(vH*3.,0.,1.));float occ=min(sh,ao);
 float nl=dot(n,uSunDir),wr=(nl+uMat.w)/(1.+uMat.w);float dif=mix(1.,max(wr,0.)*.75+.45,uShade);vec3 v=normalize(uEye-vW);float rim=pow(1.-max(dot(n,v),0.),3.)*uRim;
 float spc=pow(max(dot(n,normalize(uSunDir+v)),0.),uMat.y)*uMat.x*occ;
 /* light coming through leaves and cloth from behind */
 float trn=uMat.z*(pow(max(dot(-v,uSunDir),0.),2.)*.8+max(-nl,0.)*.35)*sh;
 /* v43: shade() with the sprite's soft terminator (uShade) as the wrap: a picture already carries its shading, the light only tilts it */
 vec3 lit=shade(c.rgb,normalize(vec3(n.x,max(n.y,.25),n.z)),vW,sh,ao,vec4(uMat.x,uMat.y,0.,mix(4.,uMat.w,uShade)),0.)+c.rgb*rim*uSunCol*sh;
 vec3 col=mix(c.rgb,lit+c.rgb*uSunCol*trn,uLit)+c.rgb*uEmit;col*=1.+vRip;o=vec4(fogit(col,vW),uAlpha);}`,
  ],
  shadow: [
    `#version 300 es
precision highp float;in vec2 aC;uniform mat4 uVP;uniform vec3 uBase,uRight;uniform vec4 uOff,uUV;uniform float uFlip,uShear;out vec2 vUV;${COMMON_GLSL}
void main(){float px=(uOff.x+aC.x*uOff.z),py=(uOff.y+aC.y*uOff.w);float h=-py;float fh=clamp(h/max(.01,-uOff.y),0.,1.),sh=uShear*h*(.25+.75*fh);vec3 p=uBase+uRight*(px*uFlip+sh)+vec3(0.,h+curveY(uBase.xz)-abs(sh)*.35*fh,0.);vUV=vec2(uUV.x+aC.x*uUV.z,uUV.y+aC.y*uUV.w);gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;uniform sampler2D uTex;out vec4 o;void main(){if(texture(uTex,vUV).a<.5)discard;o=vec4(1.);}`,
  ],
  shadowG: [
    `#version 300 es
precision highp float;in vec3 aPos;uniform mat4 uVP;uniform vec3 uOrg;out vec2 vH;${COMMON_GLSL}
void main(){vec3 p=aPos+uOrg;vH=p.xz;p.y+=curveY(p.xz);gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec2 vH;uniform vec4 uHole;out vec4 o;void main(){if(vH.x>uHole.x&&vH.x<uHole.z&&vH.y>uHole.y&&vH.y<uHole.w)discard;o=vec4(1.);}`,
  ],
  sky: [
    `#version 300 es
precision highp float;in vec2 aC;out vec2 vP;void main(){vP=aC*2.-1.;gl_Position=vec4(vP,1.,1.);}`,
    `#version 300 es
precision highp float;in vec2 vP;out vec4 o;uniform mat4 uIVP;uniform vec3 uSky0,uSky1,uSky2,uSunCol,uSunDir;uniform float uIndoor,uTime,uSunPulse,uClouds,uCloudSpd;uniform sampler2D uWorld;uniform float uWallOn;uniform vec4 uEnv;uniform vec3 uMoon;
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p*=2.03;a*=.5;}return s;}
void main(){vec4 a=uIVP*vec4(vP,-1.,1.),b=uIVP*vec4(vP,1.,1.);vec3 d=normalize(b.xyz/b.w-a.xyz/a.w);float e=d.y;
 vec3 c=e<.18?mix(uSky2,uSky1,smoothstep(-.05,.18,e)):mix(uSky1,uSky0,smoothstep(.18,.75,e));
 if(uIndoor<.5){vec2 q=d.xz/max(.12,d.y+.25);float cl=smoothstep(1.-uClouds*.5,1.3-uClouds*.5,fbm(q*.9+vec2(uTime,uTime*.5)*.000012*uCloudSpd)+.25);
  /* v26: clouds take the light of the hour: grey in bad weather, dark at night */
  vec3 cc=mix(vec3(1.,.99,.96),mix(uSky1,uSky0,.3)*1.25+.06,clamp(uEnv.z*.7+uEnv.x*.85,0.,1.));c=mix(c,cc,cl*.8*smoothstep(-.02,.2,e));
  /* alpha 0.4: after rain, a rainbow opposite the sun (42 degrees round the point opposite it, red outside) */
  if(uEnv.w>.01){float th=degrees(acos(clamp(dot(d,-normalize(uMoon)),-1.,1.))),r=(th-40.4)/2.2;if(r>0.&&r<1.&&e>-.03){float hu=(1.-r)*.78;vec3 rb=clamp(abs(fract(vec3(hu)+vec3(0.,.6667,.3333))*6.-3.)-1.,0.,1.);
   c=mix(c,c*.6+rb*.75,uEnv.w*.42*smoothstep(0.,.12,r)*smoothstep(1.,.88,r)*smoothstep(-.03,.1,e));}}
  /* v32: a high thin layer drifting the other way, bright rims on the low clouds, and a glow along the horizon */
  float cl2=smoothstep(.58,.92,fbm(q*.32+vec2(-uTime,uTime*.4)*.000007*uCloudSpd+11.))*uClouds*.6;c=mix(c,cc*1.04+.03,cl2*.45*smoothstep(.05,.35,e)*(1.-cl));
  c+=uSunCol*cl*(1.-cl)*4.*.06*(1.-uEnv.x)*(1.-uEnv.z)*smoothstep(-.02,.2,e);c=mix(c,uSky2*1.06+.02,exp(-abs(e-.02)*16.)*.22*(1.-uEnv.x*.6));
  /* phase 10: the bowl's far wall rising round the horizon (world-bowl.js bowlWallTexture: its colour, and in alpha how
     high the land reaches there), hazed by the distance; x is east and z north, as the walk scene's own map */
  float lon=atan(d.z,d.x),lat=asin(clamp(d.y,-1.,1.)),wu=lon/6.2832+.5;
  /* island track IS-3: the wall from every side: its outline averaged over a few texels (no steps), a soft top, its
     foot lost in the horizon's haze and its own colour higher up */
  vec4 wl=(texture(uWorld,vec2(wu,.5))*2.+texture(uWorld,vec2(wu+.003,.5))+texture(uWorld,vec2(wu-.003,.5))+(texture(uWorld,vec2(wu+.007,.5))+texture(uWorld,vec2(wu-.007,.5)))*.5)*(1./5.);float top=wl.a*.6*uWallOn;
  if(top>.002&&e<top+.03){float up=smoothstep(0.,top,e);vec3 land=mix(wl.rgb*(1.-uEnv.x*.75),uSky2*1.02,mix(.62,.3,up));land=mix(land,uSky1,.18*up);c=mix(c,land,smoothstep(top+.02,top-.025,e)*(1.-cl*.5));}
  /* stars and the moon */
  if(uEnv.x>.02){vec2 sq=vec2(lon*70.,lat*70.);vec2 ce=floor(sq);float h=hsh(ce);if(h>.972){vec2 f=fract(sq)-.5-(vec2(hsh(ce+3.1),hsh(ce+7.7))-.5)*.6;float st=smoothstep(.16,0.,length(f))*(.55+.45*sin(uTime*.002+h*97.));c+=vec3(.92,.94,1.)*st*uEnv.x*(1.-cl)*smoothstep(.02,.2,e)*(.6+.8*fract(h*37.));}
   float md=dot(d,normalize(uMoon));c+=vec3(.96,.95,.86)*smoothstep(.9986,.9991,md)*uEnv.x*(1.-cl*.8)+vec3(.45,.5,.7)*pow(max(md,0.),90.)*.35*uEnv.x;}
  float sun=pow(max(e,0.),28.)*uSunPulse*(1.-uEnv.x);c+=uSunCol*(sun*2.2+pow(max(e,0.),6.)*.3*uSunPulse);c+=uEnv.y*vec3(.55,.58,.7)*smoothstep(-.1,.4,e);}
 else{c*=.8+.2*fbm(d.xz*3./max(.2,abs(d.y)));}
 o=vec4(c,1.);}`,
  ],
  water: [
    `#version 300 es
precision highp float;in vec3 aPos;in float aShore;layout(location=2) in vec2 aFlow;layout(location=3) in vec2 aDK;uniform mat4 uVP;out vec3 vW;out float vS;out vec2 vF;out vec2 vDK;${COMMON_GLSL}
uniform vec4 uSea,uTide;uniform vec3 uPixW,uShoreR;uniform highp sampler2D uKinds;
void main(){vec3 p=aPos;
 /* water track WA-4: a storm heaves the open sea with its swell (the swell's own bands rolling in, uTide.w its clock), out where it is deep, fading past the
    scene's edge so the skirt's widening rings never show it; it only lifts (dipping, the ground at the scene's border showed through) */
 if(uTide.y>.01&&uSea.z>.5&&uPixW.x>.5&&texelFetch(uKinds,ivec2(int(aDK.y+.5),4),0).x>.5){vec2 r=p.xz-uSea.xy,sz=1./max(uShoreR.xy,vec2(1e-4));float ou=max(max(-p.x,p.x-sz.x),max(-p.z,p.z-sz.y));
  p.y+=(.5+.5*sin(length(r)*.55+uTide.w*1.3))*.2*uTide.y*smoothstep(.45,.9,aDK.x)*(1.-smoothstep(4.,14.,ou));}
 p.y+=curveY(p.xz);vW=p;vS=aShore;vF=aFlow;vDK=aDK;gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec3 vW;in float vS;in vec2 vF;in vec2 vDK;out vec4 o;uniform sampler2D uRefl;uniform vec2 uRes;uniform vec3 uDeep,uShallow,uSkyR;uniform float uReflK,uRip,uFoam,uGlint,uLevel,uCaus,uClar;
/* water track WA-5b: the kinds' looks in a small texture (walk/water.js kindTexture: a column a kind, a row a group), no cap on the kinds */
uniform highp sampler2D uKinds;float gEst=0.;
/* water track WA-10: in an estuary (the flow map's alpha) the river's look (the stream's column) is mixed into the body's; what a kind does (row 4) stays the body's */
vec4 kdT(int K,int r){vec4 a=texelFetch(uKinds,ivec2(K,r),0);return gEst>.004&&r!=4?mix(a,texelFetch(uKinds,ivec2(1,r),0),gEst):a;}
uniform vec4 uFish[4];uniform vec4 uRings[8];uniform sampler2D uShore;uniform vec3 uShoreR;uniform vec4 uHole;uniform vec4 uSea;uniform sampler2D uFlowTex;uniform vec3 uFlowR;${LIGHT_GLSL}${ROCK_GLSL}${PIXEL_WATER_GLSL}${FALL_GLSL}${TIDE_GLSL}
/* sunlight focused by the ripples onto the bed: thin bright lines that wander */
float caust(vec2 p,float t){vec2 q=p+vec2(lnoise(p*.7+t*.21),lnoise(p.yx*.7-t*.17))*1.6;float a=sin(q.x*4.1+t*.9)+sin(q.y*3.7-t*.7)+sin((q.x+q.y)*2.9+t*.5);return pow(clamp(1.-abs(a)*.42,0.,1.),5.);}
void main(){if(rockHides(vW))discard;if(vW.x>uHole.x&&vW.x<uHole.z&&vW.z>uHole.y&&vW.z<uHole.w)discard;float t=uTime*.001;int K=int(vDK.y+.5);
 /* water track WA-1: pc the world texel (32 a metre with pixel water), ts the stepped time of the small motions; t stays smooth for the swell and the level */
 float ts=pwStep(t),pr=pwRes(),pix=uPixW.x;vec2 pc=pwCell(vW.xz);gEst=uFlowR.z>.5&&K!=1?texture(uFlowTex,(pix>.5?pc/pr+.5/pr:vW.xz)*uFlowR.xy).w:0.;vec4 ka=kdT(K,2),kb=kdT(K,3),kc=kdT(K,4);vec3 kg=kdT(K,5).rgb;float scum=kdT(K,0).w;bool glowC=kg.r+kg.g+kg.b>.01;float dep=clamp(vDK.x,0.,1.),flo=step(vDK.x,-.5);
 /* island track IS-3: on a sea all round (uSea: the swell's centre, on), a cove's calm rides in the kind (kind + calm * .4);
    far out the small things (fish, rings, light on the bed) aren't worked out */
 float calm=max(clamp((vDK.y-float(K))*2.5,0.,1.),gEst),seaK=(kc.x>.5&&uSea.z>.5)?1.-calm*.85:0.,far=step(140.,length(vW-uEye));vec2 rd=normalize(vW.xz-uSea.xy+vec2(1e-3));
 vec2 wp=pc/pr,wq=pix>.5?wp+.5/pr:wp;
 /* water track WA-2a: the flow map (walk/water-flow.js: flow, foam, how far into the stream), read per texel; the pattern is carried down the flow in two
    phases half a loop apart, blended so its restart never shows (it drifted without end before, and still does with pixel water off) */
 vec4 fm=uFlowR.z>.5?texture(uFlowTex,wq*uFlowR.xy):vec4(vF,0.,0.);vec2 fv=fm.xy;float fph=fract(ts*.5),fbw=abs(1.-2.*fph);bool fl2=pix>.5&&dot(fv,fv)>1e-6;
 vec2 w=wp-fv*(fl2?fph*2.8:ts*1.4),w2=wp-fv*fract(fph+.5)*2.8+vec2(.37,.71);float flowing=clamp(length(fv),0.,1.);float rk=ka.w*uRip;
 /* v31: fill to the curved shoreline, lapping a little in still water */
 float vS2=vS,edge=0.,tcov=0.;if(uShoreR.z>.5){vec2 su=(wp+.5/pr)*uShoreR.xy;vec4 s4=(su.x>0.&&su.y>0.&&su.x<1.&&su.y<1.)?texture(uShore,su):vec4(1.);float sf=tideSF(s4);tcov=uTide.z>.5?step(s4.r,.45)*step(.5,s4.g):0.;float lap=(1.-flowing)*.016*sin(t*1.2+dot(wp,vec2(2.3,1.7)))+seaK*.07*sin(t*.85+dot(wp,vec2(.21,.17)));
  /* water track WA-4: the shallows the low tide leaves are drawn as wet sand on the water's own surface (the bed under them lies low, between steep banks), darker and shinier near the water */
  if(sf<.5+lap&&uTide.z>.5&&s4.r>=.5+lap){float wl=smoothstep(.5+lap-.18,.5+lap,sf);vec3 ws=vec3(.5,.41,.29)*(.86+.28*pwQ(lnoise(wp*1.7),3.,pc))*(1.-.18*pwQ(wl,3.,pc));float shs=shadowAt(vW,.002);ws*=ambient(vec3(0.,1.,0.),1.,shs)+uSunCol*max(uSunDir.y,0.)*shs;
   vec3 vv=normalize(uEye-vW);ws+=mix(uSkyR,ws,.6)*pwQ(wl*.5,3.,pc)*.25*(.3+.7*pow(1.-max(vv.y,0.),2.));o=vec4(fogit(ws,vW),1.);return;}
  /* WA-5b: past the dry shoreline a flood's skin (flo) is standing puddles in the grass, pixel-edged */
  if(sf<.5+lap){if(flo<.5||lnoise(wp*.9)*.7+lnoise(wp*2.7+3.1)*.3<.47)discard;}else vS2=max(vS,1.-smoothstep(.5,.68,sf-lap));
  /* WA-1: the shore's foam, a hard line one texel wide: a texel kept beside one the shoreline cuts away */
  if(pix>.5&&sf<.8+lap&&flo<.5){vec2 e=uShoreR.xy/pr;float m=min(min(tideSF(texture(uShore,su+vec2(e.x,0.))),tideSF(texture(uShore,su-vec2(e.x,0.)))),min(tideSF(texture(uShore,su+vec2(0.,e.y))),tideSF(texture(uShore,su-vec2(0.,e.y)))));edge=step(m,.5+lap);}}
 float r1=lnoise(w*2.3+vec2(ts*.6,ts*.4)*rk),r2=lnoise(w*3.7-vec2(ts*.5,ts*.7)*rk);if(fl2){r1=mix(r1,lnoise(w2*2.3+vec2(ts*.6,ts*.4)*rk),fbw);r2=mix(r2,lnoise(w2*3.7-vec2(ts*.5,ts*.7)*rk),fbw);}vec2 rip=(vec2(r1,r2)-.5)*.035*rk;
 /* ripple rings: from ducks, fish and insects */
 float ring=0.;for(int i=0;i<8;i++){vec4 R=uRings[i];if(far>.5)break;if(R.w<=0.)continue;float d=length(wq-R.xy),r=.08+pwStep(R.z)*.55;float band=pix>.5?step(abs(d-r),.6/pr):1.-smoothstep(.0,.06,abs(d-r));ring+=band*R.w*clamp(1.-R.z/2.4,0.,1.)*step(d,r+.1);}
 rip+=vec2(ring*.012);
 /* WA-1: the mirror moves by whole pixels (rip is the same over a texel and steps in time); the picture in it stays smooth */
 vec2 s=pix>.5?(gl_FragCoord.xy+floor(rip*uRes+.5))/uRes:gl_FragCoord.xy/uRes+rip;vec4 rf=texture(uRefl,s);rf.a*=clamp(1.-abs(vW.y-uLevel)*3.,0.,1.);vec3 v=normalize(uEye-vW);float fr=(.3+.55*pow(1.-max(v.y,0.),2.))*uReflK*(1.-kb.y*.75);if(glowC)fr*=.4;fr*=1.-.65*flo;
 vec3 shal=uShallow*kdT(K,1).rgb,deep=uDeep*kdT(K,0).rgb;
 /* water track WA-4: reef shallows: the sea's wadeable shallows (they ride below the kind, ground-mesh.js) and its water near the shore turn a clear turquoise; the bed shows through */
 float reef=(pix>.5&&kc.x>.5)?max(max(clamp((float(K)-vDK.y)/.45,0.,1.),1.-smoothstep(.12,.5,dep)),kc.z):0.,depC=mix(dep,min(dep,.28),reef);
 /* WA-5b: the reef kind takes the full turquoise; the sea's own shallows a softer, paler one (the owner) */
 shal=mix(shal,mix(vec3(.52,.88,.86),vec3(.36,.98,.9),kc.z),reef*mix(.5,.85,kc.z));vec3 base=pwTone(shal,deep,clamp(depC*.92+(1.-vS2)*.08,0.,1.),pc);float sh=shadowAt(vW,.002);
 /* fish: dark shapes under the surface, only where it is deep enough to hide them */
 float fishK=0.;for(int i=0;i<4;i++){vec4 F=uFish[i];if(far>.5)break;if(F.w<=0.)continue;vec2 d=wp-F.xy;vec2 fw=vec2(cos(F.z),sin(F.z));float lx=dot(d,fw)/F.w,ly=dot(d,vec2(-fw.y,fw.x))/F.w;
  float wig=sin(ts*9.+F.x*3.)*.04*(lx<0.?-lx*4.:0.);ly+=wig;float body=step(lx*lx/.09+ly*ly/.0081,1.);float tail=step(-.42,lx)*step(lx,-.24)*step(abs(ly),(-lx-.22)*.7);fishK=max(fishK,max(body,tail));}
 base*=1.-fishK*.45*smoothstep(.2,.45,dep);
 /* water track WA-5b: coral on a reef's bed: a clump in some cells of 0.8 m, pink, orange, violet or yellow in three tones, the fans' edges swaying in steps, fading where it deepens */
 if(kc.z>0.&&far<.5){vec2 cc=floor(wp/.8),cf=wp-cc*.8;vec3 ch=fract(sin(vec3(dot(cc,vec2(127.1,311.7)),dot(cc,vec2(269.5,183.3)),dot(cc,vec2(419.2,371.9))))*43758.55);
  if(ch.z<.6){vec2 d=cf-vec2(.22)-ch.xy*.36;float an=atan(d.y,d.x),l=length(d),rr=.13+.11*ch.x+.035*sin(an*(4.+floor(ch.y*4.))+ts*1.4*step(.3,ch.z)+ch.y*6.);
   vec3 c0=ch.y<.25?vec3(.95,.45,.55):ch.y<.5?vec3(1.,.6,.3):ch.y<.75?vec3(.68,.45,.9):vec3(.95,.85,.4);c0*=.7+.3*pwQ(1.-l/rr,3.,pc);
   base=mix(base,c0*mix(vec3(1.),shal,.35),step(l,rr)*(1.-smoothstep(.3,.6,depC))*.75*kc.z);}}
 /* water track WA-4: kelp at middle depth in the sea, out of the reef's shallows: dark fronds just under the surface in a cell of 2.6 m here and there, swaying in steps */
 float kelp=0.;vec3 kelpC=vec3(0.);if(pix>.5&&kc.x>.5&&far<.5){float kz=smoothstep(.32,.45,depC)*(1.-smoothstep(.955,.995,depC))*(1.-reef);vec2 kc=floor(wp/2.6),kf=wp-kc*2.6;
  vec3 kh=fract(sin(vec3(dot(kc,vec2(127.1,311.7)),dot(kc,vec2(269.5,183.3)),dot(kc,vec2(419.2,371.9))))*43758.55);
  if(kz>0.&&kh.z<.45){vec2 ko=vec2(.9)+kh.xy*.8;float ka2=kh.x*6.283+.3*sin(ts*.8+kh.y*6.),km=0.;
   for(int f=0;f<3;f++){float a2=ka2+float(f-1)*.6+.18*sin(ts*1.1+float(f)*2.1+kh.z*9.);vec2 dr=vec2(cos(a2),sin(a2)),d=kf-ko;float al=dot(d,dr),la=abs(dot(d,vec2(-dr.y,dr.x))),L=.8+.5*fract(kh.y*7.+float(f)*.37);
    km=max(km,step(0.,al)*step(al,L)*step(la,.13*(1.-al/L)+.05));}
   kelp=km*kz;kelpC=mix(vec3(.13,.22,.08),vec3(.24,.32,.1),step(.5,fract(dot(kf,vec2(7.3,5.1)))))*(.6+.4*sh)*(.55+.45*uAmbK);base=mix(base,kelpC,kelp*.8);}}
 base*=mix(uShTint*.85,vec3(1.),sh)*(.55+.45*uAmbK);
 /* light on the bed, brightest in the clear shallows */
 float cz=far>.5?0.:caust(wp*1.5,ts*(.6+.4*rk));cz=(pix>.5?step(.3,cz)*.8*pwQ(1.-depC,3.,pc)*(1.+reef*.6):cz*(1.-dep))*ka.y*uCaus;base+=uSunCol*cz*.32*sh;
 /* WA-5b: water with a glow of its own colour (cave water) is lit from below, brightest in its shallows, in stepped tones */
 {float g0=.6+.4*sin(ts*1.3+wp.x*1.7+wp.y);base+=glowC?kg*kb.x*pwQ(g0*(.4+.6*(1.-depC)),4.,pc)*1.05:shal*kb.x*g0;}
 vec3 refl=mix(uSkyR,rf.rgb,rf.a);vec3 c=mix(base,refl,clamp(fr,0.,1.));c=mix(c,kelpC,kelp*.45);
 /* water track WA-10: the estuary (the river's share, gEst): fresh, silty water fanning out over the sea's (a tint of its own lit colour, so it darkens at night), its edge broken up and drifting with the flow, in
    dithered tones on the grid; where its front meets the swell a broken seam of foam, stepped; pixel water off: the same, smooth */
 float eSeam=0.;if(gEst>.004&&K!=1){float en=lnoise(wp*.85-fv*ts*.35+vec2(3.1,1.7))-.5,ev=clamp(gEst*1.35+en*.45,0.,1.);float pe=pix>.5?pwQ(ev,3.,pc):ev;
  c=mix(c,c*vec3(.96,1.07,.84)*(.92+.08*sh),pe*.5);
  if(kc.x>.5){float ed=abs(gEst-.26+(lnoise(wp*1.6+vec2(ts*.15,-ts*.1))-.5)*.1);eSeam=(1.-pwHard(.012,.03,ed))*step(.42,lnoise(wp*2.4-fv*ts*.5+vec2(ts*.2,0.)))*(pix>.5?1.:.7);}}
 float foam=(pwHard(.75,1.,vS2+(r1-.5)*.35)*(.6+.4*sin(ts*2.+wp.x*3.))+flowing*pwHard(.6,.9,r2)*.5*(1.-gEst*.85))*uFoam*ka.z;
 /* WA-2a: white water from the flow map: rapids, a river's churn into still water, a fall's foot; it boils in place, in steps */
 if(fm.z>.01){float bo=lnoise(wp*5.3+vec2(ts*1.7,-ts*1.3))*.55+lnoise(wp*11.-fv*ts*.6)*.45;foam=max(foam,pwHard(.62,.72,bo+fm.z*.55)*min(1.,fm.z*1.6)*uFoam*max(ka.z,.8));}
 /* WA-5b: rapids: white water over the whole surface, streaks carried down the flow */
 if(kc.y>0.){float wr=lnoise(w*vec2(4.1,2.3)+vec2(ts*.9,-ts*.7))*.6+lnoise(w*9.3-vec2(ts*1.3,ts*.4))*.4;foam=max(foam,pwHard(.52,.58,wr+(1.-dep)*.12)*kc.y*uFoam);}
 foam=max(foam,eSeam*.6*uFoam*2.);foam=pwQ(foam,3.,pc);c=mix(c,vec3(.95,.98,1.),clamp(foam,0.,1.));
 /* WA-1: the shore's 1-pixel line, white on clear water, a pale scum on murky */
 float ek=edge*clamp(.35+ka.z*uFoam,0.,.9);c=mix(c,mix(vec3(.95,.98,1.),shal*1.5,kb.y*.6)*(.8+.2*sh),ek);foam=max(foam,ek);
 c=mix(c,vec3(.94,.97,1.),clamp(ring*.45,0.,.6));
 /* WA-5b: bubbles rising and breaking (a hot spring's, a bog's gas): a speck, then a ring one texel wide that opens and is gone, in steps */
 if(kc.w>0.&&far<.5){vec2 bc=floor(wp/.5),bf=wp-bc*.5;vec3 bh=fract(sin(vec3(dot(bc,vec2(41.3,289.1)),dot(bc,vec2(173.9,61.7)),dot(bc,vec2(97.3,211.9))))*43758.55);
  float bp=fract(ts*(.25+.35*bh.x)*(.5+.5*kc.w)+bh.y*7.),bd=length(bf-.1-bh.xy*.3),br=.02+bp*.13,on=step(bh.z,.55*kc.w);
  float bub=on*step(bp,.7)*(pix>.5?step(abs(bd-br),.6/pr):1.-smoothstep(0.,.03,abs(bd-br)))+on*step(bp,.12)*step(bd,.03);
  c=mix(c,mix(vec3(.95,.97,.96),vec3(.5,.42,.25),scum),clamp(bub*.7,0.,.7));}
 /* water track WA-2a: a waterfall's plunge pool: white water churning round its foot (a line as wide as the fall), and rings one texel wide spreading out from it, in steps */
 for(int i=0;i<4;i++){if(i>=uFallN||far>.5)break;vec4 A=uFallA[i],B=uFallB[i];vec2 d=A.zw,f=wq-A.xy-d*fallReach(B.y);float pl=max(B.z,B.x*.6);
  float dl=length(vec2(dot(f,d),max(abs(dot(f,vec2(-d.y,d.x)))-B.x*.5,0.)));if(dl>pl+.6||abs(vW.y-(B.w-B.y))>.6)continue;
  float cw=B.x*.12+.25+min(B.y,8.)*.05,bo=lnoise(wq*6.3+vec2(ts*2.1,-ts*1.7))*.5+lnoise(wq*13.-vec2(ts*1.3,ts*2.9))*.5;float chn=1.-pwHard(.45,.65,dl/cw+(bo-.5)*.9);
  float rp=fract(dl*1.5-ts*.8),rg=(pix>.5?step(rp,1.5/pr):1.-smoothstep(0.,.08,rp))*(1.-smoothstep(pl*.4,pl+.5,dl))*step(cw*.8,dl);
  c=mix(c,vec3(.95,.98,1.)*(.85+.15*sh),clamp(chn*.95+rg*.55,0.,.95));foam=max(foam,chn);}
 /* duckweed and scum: little green specks drifting together in still, murky water */
 if(kb.z>0.){vec2 dw=wp+vec2(sin(ts*.05),cos(ts*.04))*.4;float pch=pwHard(.55,.75,lnoise(dw*.7)+(1.-dep)*.3);float speck=step(.45,fract(sin(dot(floor(dw*pr),vec2(12.9898,78.233)))*43758.5));
  /* WA-5b: a bog's brown scum lies in drifting rafts in three tones, dark open water between */
  if(scum>.5){float sp=pwHard(.5,.58,lnoise(dw*1.1+3.)*.75+lnoise(dw*3.7)*.25+(1.-dep)*.1),st=pwQ(lnoise(dw*4.3+7.),3.,pc);
   c=mix(c,mix(vec3(.22,.18,.09),vec3(.5,.42,.21),st)*(.55+.45*sh)*(.6+.4*uAmbK),sp*kb.z*.92);}
  else{float wd=pch*speck*kb.z;c=mix(c,mix(vec3(.36,.5,.16),vec3(.55,.66,.24),speck*fract(dw.x*3.1))*(.55+.45*sh)*(.6+.4*uAmbK),clamp(wd,0.,1.));}}
 /* v47: whitecaps on the open sea: small crests that come and go, only out where it is deep */
 if(kc.x>.5){vec2 q=uSea.z>.5?vec2(dot(w,vec2(-rd.y,rd.x)),dot(w,rd))*vec2(2.1,4.6)+vec2(ts*.05,ts*.24):w*vec2(2.1,4.6)+vec2(ts*.21,ts*.09);float wc=lnoise(q)*lnoise(q*1.9+vec2(5.2,1.3)-vec2(ts*.17,0.));float sk=pix>.5?uTide.y:0.;wc=pwHard(.46-.1*sk,.52-.1*sk,wc)*pwQ(smoothstep(.45-.2*sk,.85-.25*sk,depC),3.,pc)*uFoam*(1.+sk)*(uSea.z>.5?1.-calm*.85:1.);c=mix(c,vec3(.95,.98,1.)*(.75+.25*sh),clamp(wc*.65,0.,.65+.2*sk));
  /* water track WA-4: a storm's sea is darker and greyer */
  c=mix(c,dot(c,vec3(.3,.59,.11))*vec3(.62,.68,.72),.35*sk)*(1.-.25*sk*(1.-calm));}
 /* IS-3: the swell, long low bands rolling in toward the island, and the surf: lines of foam that roll in over the
    shallows and break along the whole coast, broken up along it; a cove gets little of either */
 if(seaK>0.){float rr=dot(vW.xz-uSea.xy,rd);c*=1.+sin(rr*.55+t*1.3+lnoise(wp*.05)*3.)*.045*(1.+(pix>.5?2.5*uTide.y:0.))*seaK*smoothstep(.1,.6,dep);
  float sv;if(pix>.5){
   /* water track WA-4: the surf in hard stepped bands: each wave a white crest on its shore side with a broken lace trailing out to sea, rolling in
      (the phase falls with the depth), the crest thickening as the water shallows and breaking into white water at the edge; a storm sends more, wider ones */
   float st=uTide.y,nb=3.+1.5*st,ph=dep*nb+ts*(.7+.3*st)+lnoise(wp*.3)*1.6+lnoise(wp*.07)*2.,fb=fract(ph),sh2=1.-smoothstep(0.,.4,dep);
   float cw=.12+.24*sh2+.08*st,cr=step(.5,fb)*step(fb,.5+cw),lc=step(.5+cw,fb)*step(fb,.5+cw+.22+.1*st)*step(.42-.12*st,lnoise(wp*1.3+vec2(ts*.11,-ts*.07)))*(1.-(fb-.5-cw)*2.5);
   float brk=pwHard(.35,.4,lnoise(wp*.45+vec2(ts*.08,0.))+.15*sh2+.15*st),wash=pwHard(.6,.66,vS2+.08*st+(lnoise(wp*2.1+vec2(0.,ts*.4))-.5)*.3);
   float zone=step(dep,.72+.1*st)*(1.-tcov);sv=max(max(cr*brk,pwQ(lc,3.,pc)*.6)*zone,wash*.8)*seaK*min(1.,uFoam*2.5);}
  else{float ph=dep*4.+ts*.7+lnoise(wp*.3)*1.6+lnoise(wp*.07)*2.,fb=fract(ph),ln=pwHard(.45,.82,fb)*(1.-pwHard(.88,1.,fb))*smoothstep(.72,.15,dep)*smoothstep(0.,.05,dep)*pwHard(.2,.45,lnoise(wp*.45+vec2(ts*.08,0.)));sv=ln*seaK*uFoam*2.;}
  c=mix(c,vec3(.95,.98,1.)*(.8+.2*sh),clamp(sv,0.,.9));foam=max(foam,sv);
  /* water track WA-4: foam round a rock standing in the sea (vS: 1 at the rock ... 0 1.4 m out): a white collar that swells and shrinks with the swell, and rings stepping out from it */
  if(pix>.5&&vS>.01){float rk=clamp(vS/.6,0.,1.),sw=.5+.5*sin(rr*.55+t*1.3+lnoise(wp*.05)*3.);
   float fr=max(pwHard(.6,.66,rk*(.62+.5*sw+.15*uTide.y)+(r1-.5)*.4),step(abs(fract(rk*2.2+ts*.45)-.5),.06)*step(.25,rk)*(.4+.6*sw)*step(.35,lnoise(wp*3.1+ts*.2)))*seaK*min(1.,uFoam*2.5);
   c=mix(c,vec3(.95,.98,1.)*(.8+.2*sh),clamp(fr,0.,.9));foam=max(foam,fr);}}
 float n3=lnoise(w*9.+vec2(ts*1.3,-ts*.9))*lnoise(w*7.3-vec2(ts*.8,ts*1.1));if(fl2)n3=mix(n3,lnoise(w2*9.+vec2(ts*1.3,-ts*.9))*lnoise(w2*7.3-vec2(ts*.8,ts*1.1)),fbw);float gl=(pix>.5?step(.78,n3)*.6:pow(max(n3-.55,0.)*2.2,3.)*2.2)*uGlint*(1.-kb.y);c+=uSunCol*gl*sh;
 /* water track WA-4: the sun's path on the open sea, and by night the moon's (the light's direction then): the swell's facets that mirror it, a soft smooth glow under
    hard sparkling pixels that come and go in steps, kept bright enough at night to read */
 if(pix>.5&&kc.x>.5&&uSunDir.y>.02){vec2 sq=wp*.9;vec3 sn=normalize(vec3((r1-.5)*.36+(lnoise(sq+vec2(t*.11,0.))-.5)*.3,1.,(r2-.5)*.36+(lnoise(sq.yx*1.1-vec2(0.,t*.09))-.5)*.3));
  float al=max(dot(reflect(-v,sn),uSunDir),0.),lum=dot(uSunCol,vec3(.3,.59,.11));vec3 pcol=uSunCol/max(lum,.05)*min(1.2,lum*1.6+.45);
  float spk=step(.993,al)*step(.45,lnoise(wp*13.+vec2(ts*2.3,-ts*1.7)))+step(.998,al);c+=pcol*(pow(al,160.)*.4+min(spk,1.)*.75)*(.4+.6*sh)*(1.-reef*.6)*(1.-calm);}
 /* v24: lava glows under a cracked dark crust that drifts with the flow; ice is white-blue with cracks and a sheen */
 if(kb.w>.5&&kb.w<1.5){vec2 q=wp*1.3-vF*ts*.5;float n1=lnoise(q*1.7+vec2(ts*.05,0.)),n2=lnoise(q*4.1-vec2(0.,ts*.07));float crust=pwQ(smoothstep(.45,.62,n1*.7+n2*.3),3.,pc);
  vec3 hot=mix(vec3(1.,.42,.08),vec3(1.,.82,.35),pwQ(smoothstep(.55,.2,n1),3.,pc))*(1.6+.5*sin(ts*2.+n2*6.));c=mix(hot*1.3,vec3(.16,.1,.1)*(.6+.4*sh)*(.55+.45*uAmbK),crust*.85);
  o=vec4(fogit(c,vW),1.);return;}
 if(kb.w>1.5){vec2 q=wp*2.;float cr=abs(lnoise(q)-.5),cr2=abs(lnoise(q*2.3+7.)-.5);float line=1.-pwHard(.0,.03,min(cr,cr2*1.3));
  vec3 ic=mix(shal,vec3(.94,.97,1.),.55+.3*pwQ(lnoise(wp*.6),3.,pc));ic*=mix(uShTint*.9,vec3(1.),sh)*(.6+.4*uAmbK);ic=mix(ic,ic*.72,line*.7);
  vec3 icr=mix(ic,mix(uSkyR,rf.rgb,rf.a*.5),clamp(fr*.6,0.,.5));float isn=lnoise(wp*5.+ts*.02),isv=pow(max(isn-.6,0.)*2.5,3.)*1.5;icr+=uSunCol*(pix>.5?pwQ(min(isv,1.),3.,pc)+step(.86,lnoise(wp*11.+ts*.05))*step(.62,isn)*.4:isv)*sh;
  o=vec4(fogit(icr,vW),.97);return;}
 /* WA-5b: a flood's skin over the banks (depth -1, ground-mesh.js): a thin muddy film the grass shows through */
 if(flo>.5)c=mix(c,vec3(.42,.36,.24)*(.6+.4*sh)*(.55+.45*uAmbK),.3);
 /* the shallows let the bed show; murky water never does */
 float a=mix(clamp(ka.x/max(uClar,.05),0.,1.),.94,smoothstep(0.,.8,depC));a=mix(a,max(a,.8),reef);a=mix(a,.97,kb.y*.6);a=max(a,clamp(foam,0.,1.)*.9);a=mix(a,min(a,.42),flo);
 /* IS-3: the sea past the scene's edge has no land under it beyond the 8 m border: there it is opaque */
 {vec2 sz=1./max(uShoreR.xy,vec2(1e-4));float ou=max(max(-vW.x,vW.x-sz.x),max(-vW.z,vW.z-sz.y));a=mix(a,1.,smoothstep(3.,7.,ou));}
 o=vec4(fogit(c,vW),a);}`,
  ],
  fall: [
    `#version 300 es
precision highp float;in vec3 aPos;in float aShore;layout(location=2) in vec2 aFl;layout(location=3) in vec2 aBig;uniform mat4 uVP;out vec3 vW;out vec2 vT;out vec2 vB;${COMMON_GLSL}
out float vH;void main(){vec3 p=aPos;p.y+=curveY(p.xz);vW=p;vT=vec2(aFl.y,aShore*aFl.x);vH=aFl.x;vB=aBig;gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec3 vW;in vec2 vT;in float vH;in vec2 vB;out vec4 o;uniform vec3 uShallow;${LIGHT_GLSL}${ROCK_GLSL}${PIXEL_WATER_GLSL}
void main(){if(rockHides(vW))discard;
 float pr=pwRes(),pix=uPixW.x,t=pwStep(uTime*.001),sh=shadowAt(vW,.002);vec3 Lt=ambient(vec3(0,0,-1),1.,sh)*1.2+uSunCol*.6*sh;
 if(pix<.5){/* pixel water off: the sheet of before */float x=vT.x*7.,y=vT.y;float s=lnoise(vec2(x,y*2.2-t*4.5))*.6+lnoise(vec2(x*2.3+5.,y*4.-t*6.))*.4;
  vec3 c=mix(uShallow*1.1,vec3(.92,.97,1.),smoothstep(.45,.8,s));float foot=1.-smoothstep(0.,.3,vH-y);c=mix(c,vec3(.97,.99,1.),foot*.7+(1.-smoothstep(0.,.12,y))*.4);o=vec4(fogit(c*Lt,vW),.82+foot*.15);return;}
 /* water track WA-2a: the sheet in the 32 grid's texels (fc: across it in metres, down it along the water), each pixel column its own streaks stepping
    down at its own speed over a slow large pattern; a glassy curled lip; white water at the foot with a broken top edge; the outer columns thin */
 float wM=vB.x,big=vB.y,L=vH,ax=vT.x*wM;vec2 fc=vec2(floor(ax*pr),floor(vT.y*pr));float y=(fc.y+.5)/pr,ch=fract(sin(fc.x*12.9898+wM*7.13)*43758.5453);
 float sp=1.4+ch*1.3,sv=fract(y*.8-t*sp+ch*5.3),streak=step(sv,.16+.2*ch)*step(.25,ch+.2);float large=lnoise(vec2(ax*1.4+.7,y*.4-t*1.05));
 float v=clamp(.22+large*.5+streak*.5,0.,1.);float lip=big>.5?.32:.06,footL=big>.5?min(.3+L*.09,1.1):min(.18,L*.45);
 float ft=step(L-footL*(.62+.38*lnoise(vec2(ax*3.1,pwStep(uTime*.001)*2.3))),y),glass=1.-step(lip,y);
 v=mix(v,.55+.35*step(abs(y-lip*.45),1.5/pr),glass);v=max(v,ft*(.75+.25*lnoise(vec2(ax*7.,y*7.-t*3.))));v=max(v,pwQ(smoothstep(L-1.6,L,y)*.45*big,3.,fc));
 float q=pwQ(v,4.,fc);vec3 c=q<.2?uShallow*.9:q<.5?mix(uShallow,vec3(.9,.96,1.),.38):q<.8?mix(uShallow,vec3(.93,.97,1.),.7):vec3(.95,.98,1.);
 float e=min(ax,wM-ax)*pr,rag=step(e,1.+2.*step(.55,lnoise(vec2(y*2.-t*2.,fc.x*.3))));
 /* falling water stays bright in the cliff's shade (it catches the sky), and a little of its own at night */
 Lt=ambient(vec3(0,0,-1),1.,sh)*1.3+uSunCol*(.3+.4*sh);Lt=mix(Lt,vec3(dot(Lt,vec3(.3,.59,.11))),.6);c+=c*.08*(1.-uAmbK);o=vec4(fogit(c*Lt,vW),mix(.9+q*.08,.62,rag*(1.-ft)));}`,
  ],
  /* 0.1.0 alpha: the grass in the 32 px a metre pixel style, coloured by the ground it grows from. A blade is a quad
     on the pixel grid (vP: its pixels across and up); the fragment shader draws it in whole pixels: a staircase that
     narrows to the tip, bending in whole-pixel steps, in three flat bands (a darker foot, the ground's own colour, a
     lighter tip). Its colour (vG) is the ground picture's at its root (the near ring's, sharper, close to you); a tuft at
     a path's edge takes the grass beside it (kind + 8 x (direction + 1), direction in eighths of a turn) */
  grass: [
    `#version 300 es
precision highp float;in vec2 aC;in vec4 aI;in vec4 aCol;uniform mat4 uVP;uniform vec3 uRight,uPl;uniform float uT,uWind,uGust,uBend,uHK;uniform vec3 uCut;uniform vec3 uTrail[16];uniform vec3 uPush[8];
uniform sampler2D uGround,uRing;uniform vec4 uGRect;uniform vec2 uRingC[16];uniform vec4 uRingBox;uniform vec3 uCanvas;
out vec3 vW;out vec2 vP;flat out vec4 vS;flat out vec3 vK;flat out vec3 vG;${COMMON_GLSL}
${RING_AT_GLSL}
vec3 groundAt(vec2 w){vec2 g=vec2((w.x-uGRect.x)*uGRect.z,(uGRect.y-w.y)*uGRect.w);vec3 a=textureLod(uGround,g,0.).rgb;vec2 ruv;float rw=ringAt(g*uCanvas.xy,ruv);
 if(rw>0.){vec2 e=vec2(1.5/2048.,0.);vec3 r=(textureLod(uRing,ruv+e,0.).rgb+textureLod(uRing,ruv-e,0.).rgb+textureLod(uRing,ruv+e.yx,0.).rgb+textureLod(uRing,ruv-e.yx,0.).rgb)*.25;a=mix(a,r,rw);}return a;}
void main(){vec2 b=floor(aI.xy*32.+.5)/32.;float kr=aCol.x,kind=mod(kr,8.),dir=floor(kr/8.+.01),ph=aI.w;
 vec2 sp=b;if(dir>.5){float an=(dir-1.)*.7854;sp+=vec2(cos(an),sin(an))*.35;}vG=groundAt(sp);
 float h=aI.z*uHK*(uCut.z>0.?smoothstep(uCut.z*.55,uCut.z,length(b-uCut.xy)):1.);
 /* alpha 0.4: the place's one wind (windBend), the same that moves the props and the trees, a blade only a little its own */
 float gust=windGust(b,uT)*uGust;float sw=(windBend(b,uT,uGust)*2.6+sin(uT*.0041+ph*6.28)*.016)*uWind*(kind>4.5?1.3:kind>1.5&&kind<2.5?.3:1.);
 vec2 away=b-uPl.xz;float dl=length(away),pu=clamp(1.-dl/.85,0.,1.)*uBend;vec2 push=dl>.001?away/dl*pu*.75:vec2(0.);
 /* the trail you leave: blades you walked through lie flat and stand up again over a few seconds */
 for(int i=0;i<16;i++){vec3 tr=uTrail[i];if(tr.z<=0.)continue;vec2 d2=b-tr.xy;float l=length(d2),f=clamp(1.-l/.42,0.,1.)*tr.z*uBend;if(f>pu){pu=f;push=(l>.001?d2/l:vec2(.7,.7))*f*.8;}}
 /* v33: your buddy, folk and the billionaires hiding in it part the grass too (z: how far they reach) */
 for(int i=0;i<8;i++){vec3 q=uPush[i];if(q.z<=0.)continue;vec2 d2=b-q.xy;float l=length(d2),f=clamp(1.-l/q.z,0.,1.)*uBend;if(f>pu){pu=f;push=(l>.001?d2/l:vec2(.7,.7))*f*.75;}}
 /* in whole pixels: its height, its width and how far its tip leans across the screen; the lean toward or away from
    the camera stays a smooth shear */
 float Hp=floor(h*(1.-pu*.6)*32.+.5),Wp=kind<.5?2.:kind<2.5?4.:kind<4.5?2.:3.;
 vec2 off=vec2(sw*.9+push.x,sw*.25+push.y)*h,rx=normalize(uRight.xz+vec2(1e-5,0.));float sa=dot(off,rx);vec2 perp=off-rx*sa;float S=floor(sa*32.+.5);
 float x0=min(0.,S)-Wp*.5-1.,x1=max(0.,S)+Wp*.5+1.,xp=mix(x0,x1,aC.x),yp=aC.y*Hp;
 vec3 p=vec3(b.x,0.,b.y)+uRight*(xp/32.);p.xz+=perp*aC.y;p.y=aCol.z+yp/32.;p.y+=curveY(p.xz);
 vW=p;vP=vec2(xp,yp);vS=vec4(kind,Hp,Wp,S);vK=vec3(aCol.y,aCol.w,gust);gl_Position=Hp<1.?vec4(2.,2.,2.,1.):uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec3 vW;in vec2 vP;flat in vec4 vS;flat in vec3 vK;flat in vec3 vG;out vec4 o;uniform vec3 uFlw[4];uniform float uFlwGlow;uniform vec4 uHole;${LIGHT_GLSL}${ROCK_GLSL}
void main(){if(vW.x>uHole.x&&vW.x<uHole.z&&vW.z>uHole.y&&vW.z<uHole.w)discard;if(rockHides(vW))discard;
 float kind=vS.x,Hp=vS.y,Wp=vS.z,S=vS.w,rn=vK.x,tint=vK.y,r=floor(vP.y);if(r<0.||r>=Hp)discard;float t=(r+.5)/Hp;
 /* the row's width (thin blades narrow to one pixel; clover hardly narrows; a flower is a one-pixel stalk under a two-pixel head) and its place (the lean grows toward the tip) */
 bool flw=kind>3.5&&kind<4.5,head=flw&&Hp>=4.&&r>=Hp-2.;float w=flw?(head?2.:1.):max(1.,floor(Wp*(1.-t*(kind>1.5&&kind<2.5?.3:1.))+.5));
 float left=floor(S*t*t-w*.5+.5),k=floor(vP.x);if(k<left||k>=left+w)discard;
 vec3 g=vG*(.94+rn*.12);vec3 dry=vec3(.78,.7,.38);
 if(tint>0.)g=mix(g,dry,tint*.18);else g*=vec3(1.+tint*.2,1.+tint*.06,1.+tint*.12);
 if(kind>2.5&&kind<3.5)g=mix(g,dry,.35);if(kind>4.5)g*=vec3(.9,.95,.88);
 /* three flat bands, a pixel row at a time: the foot darker and cooler, the middle the ground's, the tip lighter and warmer */
 float band=t<.34?0.:t<.72?1.:2.;vec3 c=band<.5?mix(g*.79,vec3(.376,.29,.596),.17):band<1.5?g*1.05:mix(g*1.12,vec3(1.,.957,.769),.14);
 /* alpha 0.4: the flowers in the grass are the place's own (uFlw: four colours; uFlwGlow: they glow at night, as the Spore Forest's caps do) */
 if(head){int f=int(rn*4.);c=f==0?uFlw[0]:f==1?uFlw[1]:f==2?uFlw[2]:uFlw[3];if(r>=Hp-1.&&k==left&&f<2)c=mix(c,vec3(1.,.9,.4),.5);}
 c*=1.+vK.z*.09;c=seasonal(c,vW);if(uSeason.w>0.&&band>1.5)c=mix(c,vec3(.9,.93,.98),uSeason.w*.7);
 /* lit as the flat ground round it is, so the middle band is the ground's own colour */
 float sh=shadowAt(vW,.002);float ao=contactAO(vW);float occ=min(sh,ao);vec3 L=ambient(vec3(0,1,0),ao,occ)+uSunCol*max(uSunDir.y,0.)*occ+points(vW,vec3(0,1,0));
 o=vec4(fogit(c*L+(head?c*uFlwGlow:vec3(0.)),vW),0.);}`,
  ],
  face: [
    `#version 300 es
precision highp float;in vec2 aC;uniform mat4 uVP;uniform vec3 uO,uA,uB;uniform vec4 uUV;out vec2 vUV;out vec3 vW;${COMMON_GLSL}
void main(){vec3 p=uO+uA*aC.x+uB*aC.y;p.y+=curveY(uO.xz);vW=p;vUV=vec2(uUV.x+aC.x*uUV.z,uUV.y+aC.y*uUV.w);gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;in vec3 vW;out vec4 o;uniform sampler2D uTex;uniform vec3 uN;uniform float uSpec;uniform vec3 uBP;${LIGHT_GLSL}${LOOK_GLSL}
void main(){vec4 c=texture(uTex,vUV);if(c.a<.5)discard;c.rgb=lookOn(c.rgb,floor(vec2(dot(vW.xz,vec2(1.)),vW.y)*16.),clamp((vW.y-uBP.y)/3.,0.,1.),uBP);vec3 n=normalize(uN);float sh=shadowAtN(vW+n*.05,n,.0012),ao=contactAO(vW),occ=min(sh,ao);
 vec3 v=normalize(uEye-vW);float sp=pow(max(dot(n,normalize(uSunDir+v)),0.),30.)*uSpec*occ;
 o=vec4(fogit(shade(c.rgb,n,vW,sh,ao,vec4(0.,1.,0.,.2),0.)+uSunCol*sp,vW),1.);}`,
  ],
  fx: [
    `#version 300 es
precision highp float;in vec2 aC;uniform mat4 uVP;uniform vec3 uP,uRight,uUp;uniform vec2 uS;uniform vec4 uUV;out vec2 vUV;out vec3 vW;
void main(){vec2 c=aC-.5;vec3 p=uP+uRight*c.x*uS.x+uUp*(-c.y)*uS.y;vW=p;vUV=vec2(uUV.x+aC.x*uUV.z,uUV.y+aC.y*uUV.w);gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;in vec3 vW;out vec4 o;uniform sampler2D uTex,uGround;uniform vec4 uCol,uGRect,uGTint;uniform float uGlow,uLitFx;${LIGHT_GLSL}
/* 0.1.0 alpha: a flat grass prop (moss, clover) on grass takes the grass's colour, as the blades do: the ground picture
   round its middle (uGTint.xy, five taps), its own pixels' lightness over the picture's mean (uGTint.w) keeping its tones, a tenth lighter (as the blades' tips are) so it still reads, lit as the blades and the ground are */
vec3 groundTap(vec2 w){return textureLod(uGround,vec2((w.x-uGRect.x)*uGRect.z,(uGRect.y-w.y)*uGRect.w),0.).rgb;}
vec3 groundTone(vec2 w){return (groundTap(w)+groundTap(w+vec2(.25,0.))+groundTap(w-vec2(.25,0.))+groundTap(w+vec2(0.,.25))+groundTap(w-vec2(0.,.25)))*.2;}
void main(){vec4 c;if(uGlow>.5){vec2 q=vUV*2.-1.;float d=dot(q,q);if(d>1.)discard;float f=(1.-d);c=vec4(uCol.rgb*f*f*f*uCol.a,1.);}else{c=texture(uTex,vUV)*uCol;if(c.a<.02)discard;
 if(uGTint.z>.5){float sh=shadowAt(vW,.002),ao=contactAO(vW),occ=min(sh,ao);c.rgb=seasonalF(groundTone(uGTint.xy)*dot(c.rgb,vec3(.299,.587,.114))/max(uGTint.w,.02)*1.1,vW,vec2(.75,1.))*
  (ambient(vec3(0,1,0),ao,occ)+uSunCol*max(uSunDir.y,0.)*occ+points(vW,vec3(0,1,0)));}else if(uLitFx>.5)c.rgb*=mix(uAmbTop,vec3(1.),.5)+uSunCol*.4;c.rgb=fogit(c.rgb,vW);}o=c;}`,
  ],
};
provide({ WALK_SHADERS }); /* to-module */
/* ---------- phase 20 E6: the standing pictures as instances (engine/sprite-instances.js lays them out) ----------
   One draw per run of the same picture. The vertex shader is the sprite one with each picture's values read from its
   instance (no flag waves, no silhouette: those keep the sprite program); the fragment shader is the sprite one with
   those values read from flat varyings instead of uniforms (#defines put in before its main, so its lighting stays
   the very same text). A picture's own axes lie flat (right.y = back.y = 0, as every camera's do); one facing the
   camera takes the camera's (uCamRight, uCamBack). */
const SPRITE_INSTANCE_VARYINGS = `flat {io} vec4 vAxes,vBaseF,vLight,vMat,vSelfS,vWear,vHsv,vTint,vMaskFol;flat {io} vec3 vFlags;`;
const SPRITE_INSTANCE_VS = `#version 300 es
precision highp float;layout(location=0) in vec2 aC;layout(location=1) in vec3 iBase;layout(location=2) in vec4 iOff;layout(location=3) in vec4 iAxes;layout(location=4) in vec4 iBend;
layout(location=5) in vec4 iHsv;layout(location=6) in vec4 iWear;layout(location=7) in vec4 iTint;layout(location=8) in vec4 iMaskFol;layout(location=9) in vec4 iSelfFade;layout(location=10) in vec4 iLight;layout(location=11) in uvec4 iFlags;
uniform mat4 uVP;uniform vec3 uCamRight,uCamBack,uFwd;uniform float uCurveOn;uniform vec4 uMats[8];out vec2 vUV;out vec3 vW;out float vH;out float vPx;out float vRip;${SPRITE_INSTANCE_VARYINGS.replace(/\{io\}/g, 'out')}${COMMON_GLSL}
void main(){uint fl=iFlags.x;bool cam=(fl&16u)!=0u;vec2 R=cam?uCamRight.xz:iAxes.xy,B=cam?uCamBack.xz:iAxes.zw;float flip=(fl&8u)!=0u?-1.:1.;vec3 r=vec3(R.x,0.,R.y);
 vRip=0.;float px=(iOff.x+aC.x*iOff.z),py=(iOff.y+aC.y*iOff.w);float h=-py;float fh=clamp(h/max(.01,-iOff.y),0.,1.),sh=iBend.y*h*(.25+.75*fh);vec3 p=iBase+uFwd*iBend.z+r*(px*flip+sh)+vec3(0.,h+iBend.x*px*flip-abs(sh)*.35*fh,0.);
 p.y+=curveY(iBase.xz)*uCurveOn;vW=p;vPx=px*flip+sh;vH=fh;vUV=vec2(aC.x,aC.y*iBend.w);
 vAxes=vec4(R,B);vBaseF=vec4(iBase,iSelfFade.w);vLight=iLight;vMat=uMats[int(min(iFlags.y,7u))];vSelfS=vec4(iSelfFade.xyz,iBend.w);vWear=iWear;vHsv=iHsv;vTint=iTint;vMaskFol=iMaskFol;
 vFlags=vec3((fl&4u)!=0u?-1.:1.,float(fl&1u),float((fl>>1)&1u));gl_Position=uVP*vec4(p,1.);}`;
/* each per-picture uniform of the sprite fragment shader and the varying it reads instead */
const SPRITE_INSTANCE_DEFINES = [
  ['uRight', 'vec3(vAxes.x,0.,vAxes.y)'],
  ['uBack', 'vec3(vAxes.z,0.,vAxes.w)'],
  ['uBaseP', 'vBaseF.xyz'],
  ['uFade', 'vBaseF.w'],
  ['uEmit', 'vLight.x'],
  ['uLit', 'vLight.y'],
  ['uRim', 'vLight.z'],
  ['uShade', 'vLight.w'],
  ['uMat', 'vMat'],
  ['uSelf', 'vSelfS.xyz'],
  ['uUV', 'vec4(0.,0.,1.,vSelfS.w)'],
  ['uFlipN', 'vFlags.x'],
  ['uFixed', 'vFlags.y'],
  ['uNoRecv', 'vFlags.z'],
  ['lookOn(c,px,h,bp)', 'lookOnP(c,px,h,bp,vWear,vHsv,vTint,vMaskFol.xy)'],
  ['seasonal(c,p)', 'seasonalF(c,p,vMaskFol.zw)'],
  ['snowOn(c,p,u)', 'snowOnF(c,p,u,vMaskFol.zw)'],
];
function spriteInstanceFragment(fs) {
  const at = fs.indexOf('\nvoid main(){');
  if (at < 0 || fs.indexOf('\nvoid main(){', at + 1) >= 0)
    throw new Error('spriteI: the sprite fragment shader changed');
  const head = SPRITE_INSTANCE_VARYINGS.replace(/\{io\}/g, 'in'),
    defs = SPRITE_INSTANCE_DEFINES.map(([a, b]) => `#define ${a} ${b}`).join('\n');
  return fs.slice(0, at) + '\n' + head + '\n' + defs + fs.slice(at);
}
export const SPRITE_INSTANCE_SHADERS = {
  spriteI: [SPRITE_INSTANCE_VS, spriteInstanceFragment(WALK_SHADERS.sprite[1])],
};
