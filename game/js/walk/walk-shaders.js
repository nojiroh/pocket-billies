'use strict';
/* ================= WALK SHADERS =================
   Phase 20 (stage B): the walk scene's shader programs, moved from walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { COMMON_GLSL, LIGHT_GLSL, LOOK_GLSL } from '../engine/webgl.js';
expose({ WALK_SHADERS: [() => WALK_SHADERS] });
/* to-module: end */
/* ---------- shaders ---------- */
export const WALK_SHADERS = {
  ground: [
    `#version 300 es
precision highp float;in vec3 aPos;in vec3 aNrm;layout(location=2) in vec3 aWall;uniform mat4 uVP;out vec3 vW;out vec3 vN;out vec3 vWall;out vec4 vClip;${COMMON_GLSL}
void main(){vec3 p=aPos;p.y+=curveY(p.xz);vW=p;vN=aNrm;vWall=aWall;gl_Position=uVP*vec4(p,1.);vClip=gl_Position;}`,
    `#version 300 es
precision highp float;in vec3 vW;in vec3 vN;in vec3 vWall;in vec4 vClip;out vec4 o;uniform sampler2D uGround,uFar,uCliff,uGNrm,uWallA;uniform vec4 uGRect;uniform vec3 uFarTint;uniform float uGStr,uGShine,uWallDef,uAspect;uniform vec3 uWallCol[12];uniform vec3 uPlC;uniform sampler2D uShore;uniform vec3 uShoreR,uBed;uniform vec4 uRoom;uniform float uRoomY;uniform sampler2D uGAO;uniform vec3 uGAOR,uSkyW;uniform float uWet,uRainK,uCausW;uniform sampler2D uRing,uRingN;uniform vec2 uRingC[16];uniform vec4 uRingBox;uniform vec3 uCanvas;${LIGHT_GLSL}
/* v46: the near ring: the 16 m squares round you at full size (4 x 4 of them in one texture, each in the slot its
   position mod 4 gives); the view's whole ground is the small distant picture. 0 = not in the ring */
float ringAt(vec2 cc,out vec2 ruv){ruv=vec2(0.);if(uCanvas.z<.5)return 0.;vec2 ch=floor(cc/16.),s=mod(ch,4.);int si=int(s.x+.5)+int(s.y+.5)*4;vec2 h=uRingC[si];if(abs(h.x-ch.x)>.5||abs(h.y-ch.y)>.5)return 0.;
 ruv=(s*16.+(cc-ch*16.))/64.;vec2 e=min(cc-uRingBox.xy,uRingBox.zw-cc);return clamp(min(e.x,e.y)/3.,0.,1.);}
vec3 rampW(vec3 b,float t){vec3 d0=mix(b*.55,vec3(.235,.165,.439),.30),d1=mix(b*.79,vec3(.376,.29,.596),.17),l3=mix(b,vec3(1.,.957,.769),.30),l4=mix(b,vec3(1.,.988,.918),.60);return t<.5?d0:t<1.5?d1:t<2.5?b:t<3.5?l3:l4;}
float bayerG(vec2 p){ivec2 i=ivec2(mod(p,4.));int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i.y*4+i.x])+.5)/16.;}
void main(){vec3 n=normalize(vN);vec2 rcc=vec2((vW.x-uGRect.x)*uGRect.z,(uGRect.y-vW.z)*uGRect.w)*uCanvas.xy,rdx=dFdx(rcc)/64.,rdy=dFdy(rcc)/64.;vec2 ruv;float rw=ringAt(rcc,ruv);
 if(vWall.z>0.){/* a wall: between the camera and you it thins out so you stay in view */vec2 nd=vClip.xy/vClip.w;if(vClip.w<uPlC.z-.6&&length((nd-uPlC.xy)*vec2(uAspect,1.))<.26&&bayerG(gl_FragCoord.xy)<.62)discard;
  int m=int((vWall.x<.5?uWallDef:vWall.x)+.5);m=clamp(m,0,11);vec2 tc=abs(n.x)>abs(n.z)?vec2(vW.z,-vW.y):vec2(vW.x,-vW.y);vec2 gg=tc*.5,cell=vec2(float(m%4),float(m/4));
  vec2 aa=(cell+fract(gg))/vec2(4.,3.);float lv=textureGrad(uWallA,aa,dFdx(gg)/vec2(4.,3.),dFdy(gg)/vec2(4.,3.)).r*4.;vec3 a=rampW(uWallCol[m],floor(lv+.5));
  float hy=vWall.y*vWall.z,top=vWall.z-hy;a*=(top<.06?1.22:1.)*mix(.7,1.,clamp(hy/.7,0.,1.));
  /* v31: a room's walls: a skirting board along the floor, a little darker toward the corners */
  if(uRoom.w>.5&&m==10){if(hy<.18){a=vec3(.6,.4,.26)*(hy>.158?1.7:hy>.142?.62:hy<.02?.7:1.15)*(.93+.07*fract(sin(floor(tc.x*1.5)*91.7)*437.5));}else if(hy<.22)a*=.8;float cd=min(abs(vW.x-uRoom.x),abs(vW.x-uRoom.y));a*=mix(.8,1.,smoothstep(0.,.9,cd));
   /* v47: a corner trim where the back wall meets a side wall: a plain wooden post at wall height closes the joint */
   float dc=abs(n.x)>.5?abs(uRoom.z-vW.z):cd;if(dc<.07&&top>.005)a=vec3(.6,.4,.26)*(dc>.055?.62:dc<.02?1.28:1.08)*(top<.04?1.2:1.);}
  if((m<4||m==9)&&vWall.z>.3){float u=floor(tc.x*16.)/16.,rag=.09+.12*fract(sin(u*127.1)*43758.5)+.04*sin(u*4.7);vec2 gt=vec2((vW.x-n.x*.14-uGRect.x)*uGRect.z,(uGRect.y-(vW.z-n.z*.14))*uGRect.w);
   if(top<rag)a=texture(uGround,gt).rgb*(top>rag-.03?.78:1.);else if(top<rag+.05)a*=.62;}
  /* scree: pebbles fallen at the foot */
  if((m<4||m==9)&&hy<.12){float sp=fract(sin(dot(floor(vec2(tc.x,hy)*16.),vec2(12.9898,78.233)))*43758.5);if(sp>.72)a=mix(a,vec3(.62,.58,.52)*(.8+.4*sp),.6);}
  float sh=shadowAtN(vW+n*.04,n,.0012),ao=mix(contactAO(vW),1.,clamp(hy/.6,0.,1.));if(uRoom.w>.5&&m==10)ao=mix(ao,1.,.6);vec3 lit=shade(a,n,vW,sh,ao,vec4(0.,1.,0.,.25),0.);
  /* v32: sunlight thrown up off water in front of a wall: thin wandering bright lines near its foot */
  vec3 caw=vec3(0.);if(uShoreR.z>.5&&uCausW>0.){vec2 su=(vW.xz+n.xz*.7)*uShoreR.xy;if(su.x>0.&&su.y>0.&&su.x<1.&&su.y<1.){float sf=texture(uShore,su).r;if(sf>.5){vec2 q=floor(vec2(dot(vW.xz,vec2(n.z,-n.x)),vW.y)*16.)/16.;float t=uTime*.001;
   float k=sin(q.x*5.1+t*1.3+sin(q.y*3.7-t)*1.4)+sin(q.x*3.3-t*.9+q.y*4.2);float cl=pow(clamp(1.-abs(k)*.55,0.,1.),6.);caw=uSunCol*cl*.35*uCausW*smoothstep(.5,.66,sf)*(1.-smoothstep(.2,1.8,hy))*sh;}}}
  o=vec4(fogit(lit+caw,vW),0.);return;}
 /* v31: in a room, past the front edge: the floor boards' cut edge, then the dark under the floor */
 if(uRoom.w>.5&&vW.z<-.001){float d=uRoomY-vW.y;vec3 sec=d<.07?vec3(.42,.3,.2)*(d<.015?1.25:1.):d<.13?vec3(.16,.12,.1):mix(vec3(.1,.08,.09),vec3(.02,.02,.03),smoothstep(.13,1.4,d));o=vec4(fogit(sec,vW),0.);return;}
 vec2 g=vec2((vW.x-uGRect.x)*uGRect.z,(uGRect.y-vW.z)*uGRect.w);vec3 a;float spec=0.;float st=1.-n.y,c=smoothstep(.28,.5,st);
 if(g.x>0.&&g.y>0.&&g.x<1.&&g.y<1.){a=texture(uGround,g).rgb;if(rw>0.)a=mix(a,textureGrad(uRing,ruv,rdx,rdy).rgb,rw);/* v24: snow reads white, not grey */{float lm=dot(a,vec3(.3,.59,.11));a*=1.+.3*smoothstep(.74,.9,lm)*clamp(1.-abs(a.r-a.b)*4.,0.,1.);}vec4 gm=texture(uGNrm,g);if(rw>0.)gm=mix(gm,textureGrad(uRingN,ruv,rdx,rdy),rw);n=normalize(n+vec3(gm.r*2.-1.,0.,gm.g*2.-1.)*uGStr*(1.-c));spec=gm.a;
  /* v31: the shore: water tile art becomes a sandy-muddy bed, and a wet rim darkens the bank along the curved edge */
  if(uRoom.w>.5){float dw=min(min(vW.x-uRoom.x,uRoom.y-vW.x),uRoom.z-vW.z);a*=mix(.7,1.,smoothstep(0.,.75,dw));}
  if(uShoreR.z>.5){vec2 su=(floor(vW.xz*16.)+.5)/16.*uShoreR.xy;if(su.x>0.&&su.y>0.&&su.x<1.&&su.y<1.){float sf=texture(uShore,su).r;
   float blu=smoothstep(.02,.1,a.b-max(a.r,a.g)*.9)*step(.12,sf);vec3 bed=uBed*(.82+.3*lnoise(floor(vW.xz*16.)*.21))*mix(1.,.7,smoothstep(.55,.9,sf));
   /* v47: pebbles on the bed, one to a cell of an eighth of a metre (most cells), lit on their far side, on the pixel grid */
   {vec2 pq=(floor(vW.xz*32.)+.5)/32.*8.,pc=floor(pq),pf=fract(pq);vec3 ph=fract(sin(vec3(dot(pc,vec2(127.1,311.7)),dot(pc,vec2(269.5,183.3)),dot(pc,vec2(419.2,371.9))))*43758.55);
    vec2 pd=pf-(.3+ph.xy*.4);float pr=.16+ph.z*.17;if(ph.z>.28&&length(pd*vec2(1.,1.25))<pr){bed=mix(bed,vec3(.6,.58,.54)*(.7+.5*ph.x),.55)*(pd.y>pr*.25?1.18:pd.y<-pr*.4?.82:1.);}}a=mix(a,bed,max(blu,smoothstep(.5,.75,sf)*.65));
   float wet=smoothstep(.2,.46,sf);a*=1.-.26*wet;a=mix(a,a*vec3(.9,.95,1.04),wet*.5);spec=max(spec,wet*(1.-smoothstep(.5,.6,sf))*.55);n=normalize(mix(n,vec3(0.,1.,0.),wet*.6));}}}
 else a=texture(uFar,vW.xz).rgb*uFarTint*(.82+.36*lnoise(vW.xz*.11))*(.9+.2*lnoise(vW.xz*.37+7.));
 /* v32: after rain the ground is darker and a little shiny, with puddles on level paths and paving that mirror the sky */
 float pud=0.;if(uWet>0.&&g.x>0.&&g.y>0.&&g.x<1.&&g.y<1.){float grs=smoothstep(.015,.07,a.g-max(a.r,a.b));a*=1.-uWet*(.2-grs*.08);spec=max(spec,uWet*(1.-grs)*.45);
  vec2 pq=floor(vW.xz*16.)/16.;pud=smoothstep(.56,.72,lnoise(pq*.38+3.1)*.75+lnoise(pq*1.4+7.)*.3)*uWet*smoothstep(.985,.997,normalize(vN).y)*(1.-grs)*(1.-c);}
 a=snowOn(seasonal(a,vW),vW,normalize(vN).y);
if(c>0.){vec3 cx=texture(uCliff,vec2(vW.z,-vW.y)*.9).rgb,cz=texture(uCliff,vec2(vW.x,-vW.y)*.9).rgb;vec3 cl=mix(cz,cx,abs(n.x)/(abs(n.x)+abs(n.z)+.001));a=mix(a,cl*(.78+.2*n.y),c);}
 float bias=.0008+.0025*(1.-max(dot(n,uSunDir),0.));float sh=shadowAtN(vW+n*.03,n,bias);float ao=contactAO(vW);float occ=min(sh,ao);
 /* v32: soft shade baked in round the feet of trees, buildings, rocks and walls */
 float gao=1.;if(uGAOR.z>0.){vec2 gu=vW.xz*uGAOR.xy;if(gu.x>0.&&gu.y>0.&&gu.x<1.&&gu.y<1.)gao=mix(1.,texture(uGAO,gu).r,uGAOR.z);}
 if(pud>0.){vec3 vv=normalize(uEye-vW);float fr=.35+.6*pow(1.-max(vv.y,0.),3.);float rr=0.;if(uRainK>0.){vec2 cq=floor(vW.xz*16.)/16.*2.2,ci=floor(cq),cf=fract(cq)-.5;float ph=fract(uTime*.0011+fract(sin(dot(ci,vec2(12.9,78.2)))*437.5));rr=(1.-smoothstep(0.,.06,abs(length(cf)-ph*.5)))*(1.-ph)*uRainK;}
  float rim=smoothstep(.15,.4,pud)*(1.-smoothstep(.45,.75,pud));a=mix(a,mix(a*.3,uSkyW*1.3+.04,fr*.85)+rr*.3,smoothstep(.35,.7,pud)*.9);a*=1.-rim*.35;n=normalize(mix(n,vec3(0.,1.,0.),pud));spec=max(spec,pud*1.6);}
 vec3 lit=shade(a*mix(1.,gao,.35),n,vW,sh,mix(1.,ao,.7)*gao,vec4(spec*uGShine*.9,24.,0.,0.),0.);
 /* v47: alpha 0 marks the ground for the post pass: no ink outlines on it */o=vec4(fogit(lit,vW),0.);}`,
  ],
  sprite: [
    `#version 300 es
precision highp float;in vec2 aC;uniform mat4 uVP;uniform vec3 uBase,uRight;uniform vec4 uOff;uniform vec4 uUV;uniform float uFlip,uShear,uCurveOn,uDZ,uSlope;uniform vec3 uFwd,uWave;out vec2 vUV;out vec3 vW;out float vH;out float vPx;out float vRip;${COMMON_GLSL}
void main(){vRip=0.;float px=(uOff.x+aC.x*uOff.z),py=(uOff.y+aC.y*uOff.w);float h=-py;float fh=clamp(h/max(.01,-uOff.y),0.,1.),sh=uShear*h*(.25+.75*fh);/* v43: the bend grows toward the top, like a stem */vec3 p=uBase+uFwd*uDZ+uRight*(px*uFlip+sh)+vec3(0.,h+uSlope*px*uFlip-abs(sh)*.35*fh,0.);
 /* v43: a flag: cloth that ripples from the hoist (aC.x = 0) to the free end, lifting, dipping and trailing in the wind */
 if(uWave.x>0.){float ph=aC.x*6.5-uWave.y,a=uWave.x*aC.x;p+=vec3(0.,sin(ph+.8)*a*.45,0.)+uRight*(-(aC.x*aC.x)*uWave.x*.35*(.5+.5*sin(ph-1.2)))*uFlip+uFwd*sin(ph)*a*.5;vRip=cos(ph)*a*2.2;}
 p.y+=curveY(uBase.xz)*uCurveOn;vW=p;vPx=px*uFlip+sh;vH=clamp(h/max(.01,-uOff.y),0.,1.);vUV=vec2(uUV.x+aC.x*uUV.z,uUV.y+aC.y*uUV.w);gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;in vec3 vW;in float vH;in float vPx;in float vRip;out vec4 o;uniform sampler2D uTex,uNrm;uniform vec3 uRight,uBack,uSunH,uBaseP;uniform float uFade,uRim,uLit,uAlpha,uShade,uEmit,uFlipN,uFixed,uSelOut,uNoRecv;uniform vec4 uMat,uUV;uniform vec3 uSelf;${LIGHT_GLSL}${LOOK_GLSL}
float bayer(vec2 p){ivec2 i=ivec2(mod(p,4.));int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i.y*4+i.x])+.5)/16.;}
void main(){vec4 c=texture(uTex,vUV);if(c.a<.5)discard;if(uFade<.99&&bayer(gl_FragCoord.xy)>uFade)discard;
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
precision highp float;in vec3 aPos;uniform mat4 uVP;${COMMON_GLSL}
void main(){vec3 p=aPos;p.y+=curveY(p.xz);gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;out vec4 o;void main(){o=vec4(1.);}`,
  ],
  sky: [
    `#version 300 es
precision highp float;in vec2 aC;out vec2 vP;void main(){vP=aC*2.-1.;gl_Position=vec4(vP,.9999,1.);}`,
    `#version 300 es
precision highp float;in vec2 vP;out vec4 o;uniform mat4 uIVP;uniform vec3 uSky0,uSky1,uSky2,uSunCol,uSunDir;uniform float uIndoor,uTime,uSunPulse,uMirror,uClouds,uCloudSpd;uniform sampler2D uWorld;uniform vec4 uEnv;uniform vec3 uMoon;
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p*=2.03;a*=.5;}return s;}
void main(){vec4 a=uIVP*vec4(vP,-1.,1.),b=uIVP*vec4(vP,1.,1.);vec3 d=normalize(b.xyz/b.w-a.xyz/a.w);if(uMirror>.5)d.y=-d.y;float e=d.y;
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
  float lon=atan(d.z,d.x),lat=asin(clamp(d.y,-1.,1.));vec3 far=texture(uWorld,vec2(lon/6.2832+.5,.5-lat/3.1416)).rgb*(1.-uEnv.x*.8);c=mix(c,mix(far,uSky1,.55),smoothstep(.45,.95,e)*.45);
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
void main(){vec3 p=aPos;p.y+=curveY(p.xz);vW=p;vS=aShore;vF=aFlow;vDK=aDK;gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec3 vW;in float vS;in vec2 vF;in vec2 vDK;out vec4 o;uniform sampler2D uRefl;uniform vec2 uRes;uniform vec3 uDeep,uShallow,uSkyR;uniform float uReflK,uRip,uFoam,uGlint,uLevel,uCaus,uClar;
uniform vec3 uKD[9],uKS[9];uniform vec4 uKA[9],uKB[9];uniform vec4 uFish[4];uniform vec4 uRings[8];uniform sampler2D uShore;uniform vec3 uShoreR;${LIGHT_GLSL}
/* sunlight focused by the ripples onto the bed: thin bright lines that wander */
float caust(vec2 p,float t){vec2 q=p+vec2(lnoise(p*.7+t*.21),lnoise(p.yx*.7-t*.17))*1.6;float a=sin(q.x*4.1+t*.9)+sin(q.y*3.7-t*.7)+sin((q.x+q.y)*2.9+t*.5);return pow(clamp(1.-abs(a)*.42,0.,1.),5.);}
void main(){float t=uTime*.001;int K=int(vDK.y+.5);vec4 ka=uKA[K],kb=uKB[K];float dep=clamp(vDK.x,0.,1.);
 vec2 wp=floor(vW.xz*16.)/16.;vec2 w=wp-vF*t*1.4;float flowing=clamp(length(vF),0.,1.);float rk=ka.w*uRip;
 /* v31: fill to the curved shoreline, lapping a little in still water */
 float vS2=vS;if(uShoreR.z>.5){vec2 su=(wp+1./32.)*uShoreR.xy;float sf=(su.x>0.&&su.y>0.&&su.x<1.&&su.y<1.)?texture(uShore,su).r:1.;float lap=(1.-flowing)*.016*sin(t*1.2+dot(wp,vec2(2.3,1.7)));if(sf<.5+lap)discard;vS2=max(vS,1.-smoothstep(.5,.68,sf-lap));}
 float r1=lnoise(w*2.3+vec2(t*.6,t*.4)*rk),r2=lnoise(w*3.7-vec2(t*.5,t*.7)*rk);vec2 rip=(vec2(r1,r2)-.5)*.035*rk;
 /* ripple rings: from ducks, fish and insects */
 float ring=0.;for(int i=0;i<8;i++){vec4 R=uRings[i];if(R.w<=0.)continue;float d=length(wp-R.xy),r=.08+R.z*.55;float band=1.-smoothstep(.0,.06,abs(d-r));ring+=band*R.w*clamp(1.-R.z/2.4,0.,1.)*step(d,r+.1);}
 rip+=vec2(ring*.012);
 vec2 s=gl_FragCoord.xy/uRes+rip;vec4 rf=texture(uRefl,s);rf.a*=clamp(1.-abs(vW.y-uLevel)*3.,0.,1.);vec3 v=normalize(uEye-vW);float fr=(.3+.55*pow(1.-max(v.y,0.),2.))*uReflK*(1.-kb.y*.75);
 vec3 shal=uShallow*uKS[K],deep=uDeep*uKD[K];vec3 base=mix(shal,deep,clamp(dep*.92+(1.-vS2)*.08,0.,1.));float sh=shadowAt(vW,.002);
 /* fish: dark shapes under the surface, only where it is deep enough to hide them */
 float fishK=0.;for(int i=0;i<4;i++){vec4 F=uFish[i];if(F.w<=0.)continue;vec2 d=wp-F.xy;vec2 fw=vec2(cos(F.z),sin(F.z));float lx=dot(d,fw)/F.w,ly=dot(d,vec2(-fw.y,fw.x))/F.w;
  float wig=sin(t*9.+F.x*3.)*.04*(lx<0.?-lx*4.:0.);ly+=wig;float body=step(lx*lx/.09+ly*ly/.0081,1.);float tail=step(-.42,lx)*step(lx,-.24)*step(abs(ly),(-lx-.22)*.7);fishK=max(fishK,max(body,tail));}
 base*=1.-fishK*.45*smoothstep(.2,.45,dep);
 base*=mix(uShTint*.85,vec3(1.),sh)*(.55+.45*uAmbK);
 /* light on the bed, brightest in the clear shallows */
 float cz=caust(wp*1.5,t*(.6+.4*rk))*(1.-dep)*ka.y*uCaus;base+=uSunCol*cz*.32*sh;
 base+=shal*kb.x*(.6+.4*sin(t*1.3+wp.x*1.7+wp.y));
 vec3 refl=mix(uSkyR,rf.rgb,rf.a);vec3 c=mix(base,refl,clamp(fr,0.,1.));
 float foam=(smoothstep(.75,1.,vS2+(r1-.5)*.35)*(.6+.4*sin(t*2.+w.x*3.))+flowing*smoothstep(.6,.9,r2)*.5)*uFoam*ka.z;c=mix(c,vec3(.95,.98,1.),clamp(foam,0.,1.));
 c=mix(c,vec3(.94,.97,1.),clamp(ring*.45,0.,.6));
 /* duckweed and scum: little green specks drifting together in still, murky water */
 if(kb.z>0.){vec2 dw=wp+vec2(sin(t*.05),cos(t*.04))*.4;float pch=smoothstep(.55,.75,lnoise(dw*.7)+(1.-dep)*.3);float speck=step(.45,fract(sin(dot(floor(dw*16.),vec2(12.9898,78.233)))*43758.5));
  float wd=pch*speck*kb.z;c=mix(c,mix(vec3(.36,.5,.16),vec3(.55,.66,.24),speck*fract(dw.x*3.1))*(.55+.45*sh)*(.6+.4*uAmbK),clamp(wd,0.,1.));}
 /* v47: whitecaps on the open sea: small crests that come and go, only out where it is deep */
 if(K==6){vec2 q=w*vec2(2.1,4.6)+vec2(t*.21,t*.09);float wc=lnoise(q)*lnoise(q*1.9+vec2(5.2,1.3)-vec2(t*.17,0.));wc=smoothstep(.46,.52,wc)*smoothstep(.45,.85,dep)*uFoam;c=mix(c,vec3(.95,.98,1.)*(.75+.25*sh),clamp(wc*.65,0.,.65));}
 float n3=lnoise(w*9.+vec2(t*1.3,-t*.9))*lnoise(w*7.3-vec2(t*.8,t*1.1));float gl=pow(max(n3-.55,0.)*2.2,3.)*2.2*uGlint*(1.-kb.y);c+=uSunCol*gl*sh;
 /* v24: lava glows under a cracked dark crust that drifts with the flow; ice is white-blue with cracks and a sheen */
 if(kb.w>.5&&kb.w<1.5){vec2 q=wp*1.3-vF*t*.5;float n1=lnoise(q*1.7+vec2(t*.05,0.)),n2=lnoise(q*4.1-vec2(0.,t*.07));float crust=smoothstep(.45,.62,n1*.7+n2*.3);
  vec3 hot=mix(vec3(1.,.42,.08),vec3(1.,.82,.35),smoothstep(.55,.2,n1))*(1.6+.5*sin(t*2.+n2*6.));c=mix(hot*1.3,vec3(.16,.1,.1)*(.6+.4*sh)*(.55+.45*uAmbK),crust*.85);
  o=vec4(fogit(c,vW),1.);return;}
 if(kb.w>1.5){vec2 q=wp*2.;float cr=abs(lnoise(q)-.5),cr2=abs(lnoise(q*2.3+7.)-.5);float line=1.-smoothstep(.0,.03,min(cr,cr2*1.3));
  vec3 ic=mix(shal,vec3(.94,.97,1.),.55+.3*lnoise(wp*.6));ic*=mix(uShTint*.9,vec3(1.),sh)*(.6+.4*uAmbK);ic=mix(ic,ic*.72,line*.7);
  vec3 icr=mix(ic,mix(uSkyR,rf.rgb,rf.a*.5),clamp(fr*.6,0.,.5));icr+=uSunCol*pow(max(lnoise(wp*5.+t*.02)-.6,0.)*2.5,3.)*1.5*sh;
  o=vec4(fogit(icr,vW),.97);return;}
 /* the shallows let the bed show; murky water never does */
 float a=mix(clamp(ka.x/max(uClar,.05),0.,1.),.94,smoothstep(0.,.8,dep));a=mix(a,.97,kb.y*.6);a=max(a,clamp(foam,0.,1.)*.9);
 o=vec4(fogit(c,vW),a);}`,
  ],
  fall: [
    `#version 300 es
precision highp float;in vec3 aPos;in float aShore;layout(location=2) in vec2 aFl;uniform mat4 uVP;out vec3 vW;out vec2 vT;${COMMON_GLSL}
out float vH;void main(){vec3 p=aPos;p.y+=curveY(p.xz);vW=p;vT=vec2(aFl.y,aShore*aFl.x);vH=aFl.x;gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec3 vW;in vec2 vT;in float vH;out vec4 o;uniform vec3 uShallow;${LIGHT_GLSL}
void main(){float t=uTime*.001,x=vT.x*7.,y=vT.y;float s=lnoise(vec2(x,y*2.2-t*4.5))*.6+lnoise(vec2(x*2.3+5.,y*4.-t*6.))*.4;
 vec3 c=mix(uShallow*1.1,vec3(.92,.97,1.),smoothstep(.45,.8,s));float foot=smoothstep(.3,0.,vH-y);c=mix(c,vec3(.97,.99,1.),foot*.7+smoothstep(.12,0.,y)*.4);
 float sh=shadowAt(vW,.002);vec3 L=ambient(vec3(0,0,-1),1.,sh)*1.2+uSunCol*.6*sh;o=vec4(fogit(c*L,vW),.82+foot*.15);}`,
  ],
  grass: [
    `#version 300 es
precision highp float;in vec2 aC;in vec4 aI;in vec4 aCol;uniform mat4 uVP;uniform vec3 uRight,uPl;uniform float uT,uWind,uGust,uBend,uHK;uniform vec3 uCut;uniform vec3 uTrail[16];uniform vec3 uPush[8];out vec4 vK;out vec3 vW;out float vY;${COMMON_GLSL}
void main(){vec2 b=aI.xy;float kind=aCol.x,h=aI.z*uHK*(uCut.z>0.?smoothstep(uCut.z*.55,uCut.z,length(b-uCut.xy)):1.),ph=aI.w;float y=aC.y;
 /* alpha 0.4: the place's one wind (windBend), the same that moves the props and the trees, a blade only a little its own */
 float gust=windGust(b,uT)*uGust;float sw=(windBend(b,uT,uGust)*2.6+sin(uT*.0041+ph*6.28)*.016)*uWind*(kind>4.5?1.3:kind>1.5&&kind<2.5?.3:1.);
 vec2 away=b-uPl.xz;float dl=length(away),pu=clamp(1.-dl/.85,0.,1.)*uBend;vec2 push=dl>.001?away/dl*pu*.75:vec2(0.);
 /* the trail you leave: blades you walked through lie flat and stand up again over a few seconds */
 for(int i=0;i<16;i++){vec3 tr=uTrail[i];if(tr.z<=0.)continue;vec2 d2=b-tr.xy;float l=length(d2),f=clamp(1.-l/.42,0.,1.)*tr.z*uBend;if(f>pu){pu=f;push=(l>.001?d2/l:vec2(.7,.7))*f*.8;}}
 /* v33: your buddy, folk and the billionaires hiding in it part the grass too (z: how far they reach) */
 for(int i=0;i<8;i++){vec3 q=uPush[i];if(q.z<=0.)continue;vec2 d2=b-q.xy;float l=length(d2),f=clamp(1.-l/q.z,0.,1.)*uBend;if(f>pu){pu=f;push=(l>.001?d2/l:vec2(.7,.7))*f*.75;}}
 float wid=kind<.5?.07:kind<1.5?.13:kind<2.5?.11:kind<3.5?.06:kind<4.5?.07:.09;
 float bend=y*y;vec3 p=vec3(b.x,0.,b.y)+uRight*((aC.x-.5)*wid*(1.-y*(kind>1.5&&kind<2.5?.3:1.)));p.x+=(sw*.9+push.x)*bend*h;p.z+=(sw*.25+push.y)*bend*h;p.y=aCol.z+y*h*(1.-pu*.6);
 p.y+=curveY(p.xz);vW=p;vY=y;vK=vec4(kind,aCol.y,aCol.w,gust);gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec4 vK;in vec3 vW;in float vY;out vec4 o;uniform vec3 uGlo,uGhi;uniform vec3 uFlw[4];uniform float uFlwGlow;${LIGHT_GLSL}
void main(){float kind=vK.x,rn=vK.y,tint=vK.z;vec3 c=mix(uGlo,uGhi,vY)*(.86+rn*.28);vec3 dry=vec3(.78,.7,.38)*mix(.72,1.05,vY);
 if(tint>0.)c=mix(c,dry,tint*.6);else c*=vec3(1.+tint*.2,1.+tint*.06,1.+tint*.12);
 if(kind>2.5&&kind<3.5)c=mix(c,dry,.75);
 /* alpha 0.4: the flowers in the grass are the place's own (uFlw: four colours; uFlwGlow: they glow at night, as the Spore Forest's caps do) */
 if(kind>3.5&&kind<4.5&&vY>.8){int f=int(rn*4.);c=f==0?uFlw[0]:f==1?uFlw[1]:f==2?uFlw[2]:uFlw[3];if(vY>.93&&f<2)c=mix(c,vec3(1.,.9,.4),.5);}
 if(kind>4.5){c*=vec3(.8,.9,.76);c=mix(c,vec3(.82,.78,.42),smoothstep(.7,1.,vY)*.3);}
 c*=1.+vK.w*.09;c=seasonal(c,vW);if(uSeason.w>0.)c=mix(c,vec3(.9,.93,.98),uSeason.w*smoothstep(.55,1.,vY)*.7);
 float sh=shadowAt(vW,.002);float ao=contactAO(vW);float occ=min(sh,ao);vec3 L=ambient(vec3(0,1,0),ao,occ)+uSunCol*(.55+.45*vY)*occ+points(vW,vec3(0,1,0));o=vec4(fogit(c*L+(kind>3.5&&kind<4.5&&vY>.8?c*uFlwGlow:vec3(0.)),vW),0.);}`,
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
precision highp float;in vec2 vUV;in vec3 vW;out vec4 o;uniform sampler2D uTex;uniform vec4 uCol;uniform float uGlow,uLitFx;${LIGHT_GLSL}
void main(){vec4 c;if(uGlow>.5){vec2 q=vUV*2.-1.;float d=dot(q,q);if(d>1.)discard;float f=(1.-d);c=vec4(uCol.rgb*f*f*f*uCol.a,1.);}else{c=texture(uTex,vUV)*uCol;if(c.a<.02)discard;if(uLitFx>.5)c.rgb*=mix(uAmbTop,vec3(1.),.5)+uSunCol*.4;c.rgb=fogit(c.rgb,vW);}o=c;}`,
  ],
};
provide({ WALK_SHADERS }); /* to-module */
