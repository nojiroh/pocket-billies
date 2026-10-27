'use strict';
/* ================= ENGINE POST =================
   After a view draws its world into an HDR target: depth of field from real distance (round highlights for bright
   spots), bloom from bright pixels (this is what makes windows glow: their lit glass; lamps, fires and signs also get a
   small glow disc in the effects pass, walk/effects.js), then exposure, a soft highlight roll-off instead of clipping,
   contrast, saturation, warmth, vignette, chromatic aberration, grain
   and a light sharpen. Also takes a small screenshot for the debug log when asked. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { environment, provide, reducedMotion } from '../hooks.js';
import { clamp } from '../util.js';
import { makeCanvas } from '../art.js';
import { walkView } from '../walk-view.js';
import { engineColor, engineContext, engineSetting } from './settings.js';
import { COMMON_GLSL, LIGHT_GLSL, bindQuad, ensurePrograms, gpuState, renderTarget } from './webgl.js';
import { setLightUniforms } from './light.js';
/* eslint-disable no-func-assign */
expose({
  COLOR_GRADES: [() => COLOR_GRADES],
  POST_EFFECT_SHADERS: [() => POST_EFFECT_SHADERS],
  POST_MEDIUMP: [() => POST_MEDIUMP],
  colorGrade: [() => colorGrade, v => (colorGrade = v)],
  drawDepthOfField: [() => drawDepthOfField, v => setDrawDepthOfField(v)],
  drawPostEffects: [() => drawPostEffects, v => setDrawPostEffects(v)],
  drawPostRest: [() => drawPostRest, v => setDrawPostRest(v)],
  postTex: [() => postTex, v => (postTex = v)],
  postUse: [() => postUse, v => (postUse = v)],
  projectToScreenUv: [() => projectToScreenUv, v => (projectToScreenUv = v)],
  screenSnapshot: [() => screenSnapshot, v => setScreenSnapshot(v)],
  sunScreenPosition: [() => sunScreenPosition, v => (sunScreenPosition = v)],
});
/* eslint-enable no-func-assign */
export function setDrawDepthOfField(v) {
  drawDepthOfField = v; // eslint-disable-line no-func-assign
  provide({ drawDepthOfField });
}
export function setDrawPostEffects(v) {
  drawPostEffects = v; // eslint-disable-line no-func-assign
  provide({ drawPostEffects });
}
export function setDrawPostRest(v) {
  drawPostRest = v; // eslint-disable-line no-func-assign
  provide({ drawPostRest });
}
export function setScreenSnapshot(v) {
  screenSnapshot = v; // eslint-disable-line no-func-assign
  provide({ screenSnapshot });
}
/* to-module: end */
export const POST_EFFECT_SHADERS = {
  dof: [
    `#version 300 es
precision highp float;in vec2 aC;out vec2 vUV;void main(){vUV=aC;gl_Position=vec4(aC*2.-1.,0.,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;out vec4 o;uniform sampler2D uCol,uDep,uNear;uniform vec2 uPx;uniform float uN,uF,uBand,uRampF,uRampN,uMaxR,uBokeh,uEdge,uNearOn;uniform vec4 uPlane;uniform int uTaps;
float lin(float d){float z=d*2.-1.;return 2.*uN*uF/(uF+uN-z*(uF-uN));}
/* CAM-3: the distance from the plane of focus at screen place q and view depth z (logic/lens-focus.js; tilt 0: z - focus) */
float pd(vec2 q,float z){return z*dot(vec3(1.,q),uPlane.xyz)-uPlane.w;}
float cocd(float dz){return dz>0.?smoothstep(uBand,uBand+uRampF,dz):smoothstep(uBand*.6,uBand*.6+uRampN,-dz);}
/* CAM-3: Engine > Lens > Edge blur: none in the middle of the screen, the most in the corners (logic/lens-focus.js edgeBlur) */
float edge(vec2 q){vec2 e=(q-.5)*2.;return uEdge*smoothstep(.6,1.25,length(vec2(e.x,e.y*.85)));}
float coc(vec2 q,float z){return max(cocd(pd(q,z)),edge(q));}
/* CAM-3: a sample counts where its own blur reaches this pixel (scatter as gather, after Dennis Gustafsson): a sharp
   thing in front keeps out of the blur behind it (no halo round it), a sample behind counts with its blur held to
   twice this pixel's (only behind the focus: in front of it, as before, everything behind counts), and a blurred thing in front spills over the sharp pixels beside it (four probes at the widest
   reach find it, then the gather is as wide as its blur). The alpha is the spill only: the composite works out each pixel's own blur at full size.
   Spread blur in front (lens.nearSpread, uNearOn): the probes give way to uNear, the most blur in front of the focus
   in the tiles round this pixel (the dofnear and dofgrow passes), and a sample more blurred than this pixel and in
   front of it reaches as far as that: a blurred thing in front then softens over what is behind it (its own outline is
   its least blurred part, so its spill reached a pixel or two and stopped there). What isn't in front counts only
   within this pixel's own blur, so the wider gather doesn't blur the sharp ground beside it. */
float cover(float s,float d){return clamp((s-d)*12.+.5,0.,1.);}
void main(){float zc=lin(texture(uDep,vUV).r),dc=pd(vUV,zc),cc=max(cocd(dc),edge(vUV)),R=cc;bool far=dc>0.,ns=uNearOn>.5;vec3 acc=texture(uCol,vUV).rgb;float ws=1.,wn=0.,nf=0.,wf=0.,nc=0.;vec3 af=vec3(0.);
 if(ns){nf=texture(uNear,vUV).r;R=max(R,nf);}else for(int k=0;k<4;k++){vec2 q=vUV+vec2(k<2?-.6:.6,k==0||k==2?-.6:.6)*uMaxR*uPx;float zs=lin(texture(uDep,q).r);if(zs<zc)R=max(R,coc(q,zs));}
 if(R>.02){float nt=float(uTaps),jr=ns?6.2832*fract(52.9829*fract(dot(gl_FragCoord.xy,vec2(.06711,.00584)))):0.;/* (spread: the spiral turned per pixel, so its few wide taps make fine noise, not bands) */
  for(int i=0;i<28;i++){if(i>=uTaps)break;float a=float(i)*2.39996+jr,r=sqrt((float(i)+.5)/nt);vec2 q=vUV+vec2(cos(a),sin(a))*r*uMaxR*R*uPx;
  float zs=lin(texture(uDep,q).r),cs=coc(q,zs),d=r*R;bool fr=zs<zc;if(ns){fr=fr&&cs>cc+.02;if(fr)cs=max(cs,nf);}float w=fr?cover(cs,d):far?cover(min(cs,cc*2.),d):ns?cover(cc,d):1.;vec3 s=texture(uCol,q).rgb;float l=dot(s,vec3(.3,.59,.11)),w0=w;w*=1.+smoothstep(.8,1.6,l)*2.5*uBokeh;if(ns&&fr){af+=s*w;wf+=w;nc+=w0;}else{acc+=s*w;ws+=w;if(fr)wn+=w;}}}
 /* (spread: the share of the taps that land on the blurred thing in front is how much of it covers this pixel, laid over
    this pixel's own blur; its alpha is that cover, which the composite blends by) */
 if(ns){float cv=min(1.,nc/float(uTaps));o=vec4(wf>0.?mix(acc/ws,af/wf,cv):acc/ws,R>cc+.01?cv:0.);}else o=vec4(acc/ws,R>cc+.01?min(1.,wn/ws*2.)*R:0.);}`,
  ],
  /* Spread blur in front: the most blur in front of the focus in each 16 x 16 tile of the full-size depth (every other
     pixel each way), then grown uGrow tiles each way, so a pixel beside a blurred thing in front knows that thing's blur */
  dofnear: [
    `#version 300 es
precision highp float;in vec2 aC;out vec2 vUV;void main(){vUV=aC;gl_Position=vec4(aC*2.-1.,0.,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;out vec4 o;uniform highp sampler2D uDep;uniform float uN,uF,uBand,uRampN;uniform vec4 uPlane;
float lin(float d){float z=d*2.-1.;return 2.*uN*uF/(uF+uN-z*(uF-uN));}
void main(){ivec2 sz=textureSize(uDep,0),b=ivec2(gl_FragCoord.xy)*16;vec2 S=vec2(sz);float m=0.;
 for(int j=0;j<16;j+=2)for(int i=0;i<16;i+=2){ivec2 p=min(b+ivec2(i,j),sz-1);float d=texelFetch(uDep,p,0).r;if(d>=1.)continue;
  float dz=lin(d)*dot(vec3(1.,(vec2(p)+.5)/S),uPlane.xyz)-uPlane.w;if(dz<0.)m=max(m,smoothstep(uBand*.6,uBand*.6+uRampN,-dz));}
 o=vec4(m,0.,0.,1.);}`,
  ],
  dofgrow: [
    `#version 300 es
precision highp float;in vec2 aC;out vec2 vUV;void main(){vUV=aC;gl_Position=vec4(aC*2.-1.,0.,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;out vec4 o;uniform sampler2D uT;uniform int uGrow;
void main(){ivec2 c=ivec2(gl_FragCoord.xy),s=textureSize(uT,0)-1;float m=0.;
 for(int j=-4;j<=4;j++)for(int i=-4;i<=4;i++){if(abs(i)>uGrow||abs(j)>uGrow)continue;m=max(m,texelFetch(uT,clamp(c+ivec2(i,j),ivec2(0),s),0).r);}
 o=vec4(m,0.,0.,1.);}`,
  ],
  bright: [
    `#version 300 es
precision highp float;in vec2 aC;out vec2 vUV;void main(){vUV=aC;gl_Position=vec4(aC*2.-1.,0.,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;out vec4 o;uniform sampler2D uCol;uniform vec2 uPx;uniform float uT;
void main(){vec3 c=vec3(0.);for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++)c+=texture(uCol,vUV+vec2(i,j)*uPx).rgb;c/=9.;float l=max(c.r,max(c.g,c.b));float k=max(0.,l-uT*.82)/max(l,1e-3);k=k*k/(k+.15);o=vec4(c*k,1.);}`,
  ],
  down: [
    `#version 300 es
precision highp float;in vec2 aC;out vec2 vUV;void main(){vUV=aC;gl_Position=vec4(aC*2.-1.,0.,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;out vec4 o;uniform sampler2D uCol;uniform vec2 uPx;
void main(){vec3 c=texture(uCol,vUV).rgb*4.;vec4 q0=texture(uCol,vUV),q1=texture(uCol,vUV+vec2(-1,-1)*uPx),q2=texture(uCol,vUV+vec2(1,-1)*uPx),q3=texture(uCol,vUV+vec2(-1,1)*uPx),q4=texture(uCol,vUV+vec2(1,1)*uPx);c+=q1.rgb+q2.rgb+q3.rgb+q4.rgb;o=vec4(c/8.,(q0.a*4.+q1.a+q2.a+q3.a+q4.a)/8.);}`,
  ],
  up: [
    `#version 300 es
precision highp float;in vec2 aC;out vec2 vUV;void main(){vUV=aC;gl_Position=vec4(aC*2.-1.,0.,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;out vec4 o;uniform sampler2D uCol;uniform vec2 uPx;uniform float uR;
void main(){vec2 d=uPx*uR;vec3 c=texture(uCol,vUV+vec2(-d.x,0)).rgb+texture(uCol,vUV+vec2(d.x,0)).rgb+texture(uCol,vUV+vec2(0,-d.y)).rgb+texture(uCol,vUV+vec2(0,d.y)).rgb;
 c=c*2.+texture(uCol,vUV+vec2(-d.x,-d.y)).rgb+texture(uCol,vUV+vec2(d.x,-d.y)).rgb+texture(uCol,vUV+vec2(-d.x,d.y)).rgb+texture(uCol,vUV+vec2(d.x,d.y)).rgb;o=vec4(c/12.,1.);}`,
  ],
  ao: [
    `#version 300 es
precision highp float;in vec2 aC;out vec2 vUV;void main(){vUV=aC;gl_Position=vec4(aC*2.-1.,0.,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;out vec4 o;uniform sampler2D uDep;uniform vec2 uPx,uFade;uniform float uN,uF,uR,uFoc,uRange,uPlane;
float lin(float d){float z=d*2.-1.;return 2.*uN*uF/(uF+uN-z*(uF-uN));}
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
uniform float uKind;
/* v43: horizon-based occlusion. Along four directions (rotated per pixel) the pixel walks outward and keeps the steepest
   rise above its own depth: the higher the horizon all round, the less of the sky it sees. Falls off with distance so
   only nearby things count, and fades out far from the camera where a pixel is many metres. */
float horizonAO(float z,float r,float a0){float occ=0.;float mpp=z/uFoc;/* metres per screen pixel at this depth */
 /* Occlusion follows the slope (uPlane): along two lines through the pixel, the rise seen both ways at once (their
    mean): any plane, flat or seen at a slant, rises one way as much as it falls the other and gives nothing; a crease
    rises both ways. On screen a plane's 1/depth runs straight, so the two are met in their harmonic mean. (A one-pixel
    slope estimate was all depth steps out here: about 20 cm at 40 m) */
 if(uPlane>.5){for(int d=0;d<2;d++){float a=a0+float(d)*1.5708;vec2 dir=vec2(cos(a),sin(a))*uPx;float hz=0.;
  for(int i=1;i<=5;i++){float k=(float(i)-.3)/5.;vec2 q=dir*r*k*k*5.;float zp=lin(texture(uDep,vUV+q).r),zm=lin(texture(uDep,vUV-q).r);
   float dist=max(.05,r*k*k*5.*mpp),w=1.-smoothstep(uRange*.6,uRange*2.,max(z-zp,z-zm));hz=max(hz,(z-2./(1./zp+1./zm)-.03)/dist*w);}
  occ+=2.*clamp(hz,0.,1.)*clamp(hz*1.4,0.,1.);}
  return occ/4.;}
 for(int d=0;d<4;d++){float a=a0+float(d)*1.5708;vec2 dir=vec2(cos(a),sin(a))*uPx;float hz=-1.;
  for(int i=1;i<=5;i++){float k=(float(i)-.3)/5.;vec2 q=vUV+dir*r*k*k*5.;float zs=lin(texture(uDep,q).r);float dz=z-zs-.03;float dist=max(.05,r*k*k*5.*mpp);float sl=dz/dist;float w=1.-smoothstep(uRange*.6,uRange*2.,dz);hz=max(hz,sl*w*step(0.,dz));}
  occ+=clamp(hz,0.,1.)*clamp(hz*1.4,0.,1.);}
 return occ/4.;}
void main(){float d0=texture(uDep,vUV).r;if(d0>.9999){o=vec4(0.);return;}float z=lin(d0),r=clamp(uR*uFoc/z,2.,40.),a0=h(gl_FragCoord.xy)*6.28,occ=0.,bias=.04+z*.015;
 if(uKind>.5){o=vec4(horizonAO(z,r,a0)*(1.-smoothstep(uFade.x,uFade.y,z)),0.,0.,1.);return;}
 for(int i=0;i<10;i++){float a=a0+float(i)*2.39996,k=sqrt((float(i)+.5)/10.);vec2 q=vUV+vec2(cos(a),sin(a))*k*r*uPx;float zs=lin(texture(uDep,q).r),dz=z-zs;
  occ+=step(bias,dz)*(1.-smoothstep(uRange*.4,uRange,dz));}
 o=vec4(occ/10.*(1.-smoothstep(uFade.x,uFade.y,z)),0.,0.,1.);}`,
  ],
  rays: [
    `#version 300 es
precision highp float;in vec2 aC;out vec2 vUV;void main(){vUV=aC;gl_Position=vec4(aC*2.-1.,0.,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;out vec4 o;uniform sampler2D uCol,uDep;uniform vec2 uSun;uniform float uLen,uVirt;
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
uniform float uAsp;
vec3 src(vec2 q){if(q.x<0.||q.y<0.||q.x>1.||q.y>1.)return vec3(0.);float sky=step(.9999,texture(uDep,q).r);vec3 c=texture(uCol,q).rgb;vec2 dd=(q-uSun)*vec2(uAsp,1.);float glow=mix(exp(-dot(dd,dd)*12.),1.,uVirt);float lum=dot(c,vec3(.3,.59,.11));return c*max(sky*glow,mix(smoothstep(1.2,2.2,lum)*.8,smoothstep(.55,1.25,lum)*.55,uVirt)*glow);}
void main(){vec2 dv=(uSun-vUV);if(uVirt>.5)dv=normalize(dv)*.32;dv*=uLen/24.;vec2 q=vUV+dv*h(gl_FragCoord.xy);vec3 acc=vec3(0.);float w=1.,tw=0.;for(int i=0;i<24;i++){acc+=src(q)*w;tw+=w;w*=.93;q+=dv;}
 o=vec4(acc/tw,1.);}`,
  ],
  vol: [
    `#version 300 es
precision highp float;in vec2 aC;out vec2 vUV;void main(){vUV=aC;gl_Position=vec4(aC*2.-1.,0.,1.);}`,
    `#version 300 es
precision highp float;precision highp sampler3D;in vec2 vUV;out vec4 o;uniform sampler2D uDep;uniform mat4 uIVP;uniform float uN,uF,uK,uLK,uDens,uMaxD,uAirN,uFollow;${LIGHT_GLSL}${COMMON_GLSL}
/* air track AIR-3: the low fog's density grid (walk/fog-grid.js, an R8 3D texture: repeat in x and z, clamp in y, in
   flat world positions), its box, its scale (1/(nx cell), 1/(nz cell), 1/cell, its floor oy), its square (middle x, z,
   half size, ny); how thick (uFogK, the Fog in the air dial; 0: no fog in the march), lamps in it, the steps */
uniform sampler3D uFogT;uniform vec3 uFogLo,uFogHi;uniform vec4 uFogS,uFogC;uniform float uFogK,uFogLK,uSteps;
/* v43: light in the air. From the camera to what each pixel shows, the ray is walked in twelve steps; at each the sun's
   shadow map says whether the air there is lit (the near map first, the far cascade beyond it), and the nearest lamps
   add their glow. Forward scattering (Henyey-Greenstein) makes rays toward the sun bright; the air is thickest low down. */
float lin(float d){float z=d*2.-1.;return 2.*uN*uF/(uF+uN-z*(uF-uN));}
float vis(vec3 p){if(uShadowOn<.5)return 1.;vec4 q=uShadowM*vec4(p,1.);vec3 c=q.xyz/q.w*.5+.5;if(c.x>.01&&c.y>.01&&c.x<.99&&c.y<.99&&c.z<=1.)return texture(uShadow,vec3(c.xy,c.z-.002));
 if(uShadow2On<.5)return 1.;vec4 q2=uShadowM2*vec4(p,1.);vec3 c2=q2.xyz/q2.w*.5+.5;if(c2.x<0.||c2.y<0.||c2.x>1.||c2.y>1.||c2.z>1.)return 1.;return texture(uShadow2,vec3(c2.xy,c2.z-.003));}
/* the fog at a point: the grid read at the flat height (the world's curve put back), fading out toward the grid's edge,
   where fogit's mist fades in (logic/fog-grid.js FOG_EDGE, fogGridInside) */
float fogAt(vec3 p){vec3 q=vec3(p.x*uFogS.x,((p.y+curveY(p.xz))*uFogS.z-uFogS.w)/uFogC.w,p.z*uFogS.y);
 return texture(uFogT,q).r*(1.-smoothstep(uFogC.z*.7,uFogC.z*.95,max(abs(p.x-uFogC.x),abs(p.z-uFogC.y))));}
vec3 lampAt(vec3 p){vec3 a=vec3(0.);for(int l=0;l<6;l++){if(l>=uNL||float(l)>=uAirN)break;vec4 Lp=uLP[l];vec3 d=Lp.xyz-p;float r=abs(Lp.w),ll=length(d);float f=max(0.,1.-ll/(r*1.3));a+=uLC[l].rgb*f*f/(1.+ll*ll*.35);}return a;}
void main(){float d0=texture(uDep,vUV).r;vec4 wp=uIVP*vec4(vUV*2.-1.,min(d0,.9999)*2.-1.,1.);vec3 P=wp.xyz/wp.w;vec3 ray=P-uEye;float L=length(ray);vec3 dir=ray/max(L,.001);float L0=d0>.9999?1e4:L;L=min(L,uMaxD);
 float j=lhash(gl_FragCoord.xy*.37);float cs=dot(dir,uSunDir);const float g=.45;float ph=(1.-g*g)/pow(1.+g*g-2.*g*cs,1.5);
 vec3 sun=vec3(0.),lamps=vec3(0.);
 /* alpha 0.4.1: seen from above, the air that matters is the last stretch above the ground, where trees, roofs and
    awnings stand in the light. The march covers only that stretch, the air is thickest near the ground, and the phase
    has a broad part as well as the forward peak, so beams through leaves and between houses read from the game's camera */
 /* AIR-3: with the fog grid the march starts where the ray enters the grid's box (or the shafts' stretch, if nearer)
    and runs to the surface or out of the box, in uSteps steps; the shafts still count only their last 14 m. Without
    it, the old 14 steps over the last 14 m */
 bool sh=uK>0.||uLK>0.;float s0=max(0.,L-14.),t0=s0,t1=L,N=14.,fa=0.,fb=-1.;
 if(uFogK>0.){vec3 iv=mix(vec3(-1.),vec3(1.),step(0.,dir))/max(abs(dir),vec3(1e-6)),ta=(uFogLo-uEye)*iv,tb=(uFogHi-uEye)*iv,mn=min(ta,tb),mx=max(ta,tb);
  fa=max(0.,max(max(mn.x,mn.y),mn.z));fb=min(L0,min(min(mx.x,mx.y),mx.z));
  if(fa<fb){t0=sh?min(s0,fa):fa;t1=sh?max(L,fb):fb;N=uSteps;}else if(!sh){o=vec4(0.);return;}}
 /* the fog: 0.22 per m at full density thins what is behind it (T) and adds the light it scatters: the sky's (the
    haze colour, dimmer in shade and with the sun's brightness sl, so it is dark under the moon and the lamps carry it),
    the sun's through the shadow maps with the forward phase (shafts in the fog), and the lamps' glow */
 float dt=(t1-t0)/N,T=1.,sl=min(1.,dot(uSunCol,vec3(.3,.59,.11)));vec3 fc=vec3(0.);
 for(int i=0;i<14;i++){if(float(i)>=N)break;float t=t0+(float(i)+j)*dt;vec3 p=uEye+dir*t;
  float w=sh&&t>=s0&&t<=L?1.:0.,fd=t>=fa&&t<=fb?fogAt(p)*uFogK:0.;if(w+fd<=0.)continue;
  float v=vis(p);vec3 lp=(w>0.&&uLK>0.)||(fd>0.&&uFogLK>0.)?lampAt(p):vec3(0.);
  if(w>0.){float dens=exp(-max(0.,p.y-P.y)*.32)*.85+exp(-max(0.,p.y-uMistY)*.1)*.15;float dd=dens*dt*.045;sun+=vec3(v*dd,dd,0.);lamps+=lp*dt;}
  if(fd>0.){float a=1.-exp(-fd*.22*dt);fc+=T*a*(uFogCol*(.45+.55*sl*(.4+.6*v))+uSunCol*v*ph*.18+lp*uFogLK*.5);T*=1.-a;}}
 /* lit air brightens a little; air in the shadow of a canopy or a roof darkens what is behind it (alpha), so the beams
    show as light and dark columns, on any graphics chip (no negative light needed) */
 float pk=(ph*.6+.55)*uDens*step(d0,.9999)*(1.-smoothstep(26.,46.,length(ray)));/* not in the sky, and fading out with distance: the beams are a near thing */
 vec3 sr=uSunCol*min(sun.x*pk*.4,1.2)*uK+lamps*uLK*.18;float sa=clamp((sun.y-sun.x)*pk*1.1*uK*mix(1.,min(1.,dot(uSunCol,vec3(.3,.59,.11))*1.25),uFollow),0.,.6);
 /* AIR-3: the fog in front, premultiplied (the grade pass does c*(1-a)+rgb); T is 1 without fog, the old output */
 o=vec4(sr*T+fc,1.-(1.-sa)*T);}`,
  ],
  grade: [
    `#version 300 es
precision highp float;in vec2 aC;out vec2 vUV;void main(){vUV=aC;gl_Position=vec4(aC*2.-1.,0.,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;out vec4 o;uniform sampler2D uCol,uDof,uBloom,uAO,uRays,uDep,uVol;uniform vec2 uPx;uniform vec4 uHeatS[6];uniform float uHeatN;uniform vec4 uDofPl,uDofB;uniform float uDofView;uniform vec3 uInkF;uniform float uVolK,uExp,uShoulder,uCon,uSat,uWarm,uVig,uCA,uGrain,uSharp,uBloomK,uTime,uDofOn,uAOK,uRaysK,uTone,uHeat,uInk,uNear,uFar,uGlare;uniform vec3 uLift,uGam,uGain,uShT,uHiT,uRayC,uSunP;
float linz(float d){float z=d*2.-1.;return 2.*uNear*uFar/(uFar+uNear-z*(uFar-uNear));}
/* film grain (2026-10): a hash without sine (Dave Hoskins), steady on phone graphics chips where the sine one makes
   patterns; soft grains about 1.5 pixels across, a new field 24 times a second, mostly brightness with a little colour,
   strongest in the midtones and faint in deep shade and bright highlights, as on film */
float gh(vec3 p){p=fract(p*vec3(.1031,.103,.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
float gv(vec2 q,float f){vec2 i=floor(q),u=fract(q);u=u*u*(3.-2.*u);return mix(mix(gh(vec3(i,f)),gh(vec3(i+vec2(1,0),f)),u.x),mix(gh(vec3(i+vec2(0,1),f)),gh(vec3(i+vec2(1,1),f)),u.x),u.y);}
vec3 grain(vec3 c){float f=mod(floor(uTime*.024),997.),l=clamp(dot(c,vec3(.3,.59,.11)),0.,1.);vec2 q=gl_FragCoord.xy/1.5;
 float m=gv(q,f)-.5;vec3 k=vec3(gh(vec3(q,f+1.)),gh(vec3(q,f+2.)),gh(vec3(q,f+3.)))-.5;
 return c+(m*1.6*.85+k*.15)*uGrain*mix(1.,4.*l*(1.-l),.8);}
vec3 roll(vec3 c){float t=uShoulder;vec3 x=max(c-t,0.);return min(c,vec3(t))+(1.-t)*(1.-exp(-x/(1.-t)));}
/* v32: a film curve (ACES, fitted): deeper darks, a long soft shoulder, colours that hold in bright light */
vec3 film(vec3 c){c*=.82;return clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);}
void main(){vec2 uv=vUV;/* v32: heat shimmer above hot ground (lava, desert noon), strongest a little below the middle of the view */
    /* alpha 0.4: lighter and stylized: the ripple steps in half pixels, slower, gentler */
 if(uHeat>0.){float band=smoothstep(.12,.42,uv.y)*smoothstep(.8,.5,uv.y),w=sin(uv.y*70.+uTime*.0045)+.5*sin(uv.y*31.-uTime*.003+uv.x*14.);uv.x+=floor(w*1.6+.5)/2.*uPx.x*.9*uHeat*band;}
 /* alpha 0.4: a small shimmer just above each fire (uHeatS: where on screen, and how big) */
 for(int i=0;i<6;i++){if(float(i)>=uHeatN)break;vec4 hs=uHeatS[i];vec2 q=(uv-hs.xy)/hs.zw;float m=smoothstep(1.,.25,length(q))*step(0.,q.y+.35);if(m>0.){float w=sin(uv.y/hs.w*9.+uTime*.009+float(i)*2.3);uv.x+=floor(w*1.6+.5)/2.*uPx.x*1.1*m;}}
 vec2 d=uv-.5;vec2 ca=d*dot(d,d)*uCA*uPx*6.;vec3 s=vec3(texture(uCol,uv-ca).r,texture(uCol,uv).g,texture(uCol,uv+ca).b);
 if(uSharp>0.){vec3 n=texture(uCol,vUV+vec2(uPx.x,0)).rgb+texture(uCol,vUV-vec2(uPx.x,0)).rgb+texture(uCol,vUV+vec2(0,uPx.y)).rgb+texture(uCol,vUV-vec2(0,uPx.y)).rgb;s+=(s-n*.25)*uSharp;}
 /* CAM-3: the blur's amount worked out here at full size from the full-size depth (the same plane of focus as the
    blur pass), so the edge between sharp and blurred follows the real edges; the half-size alpha adds only the spill
    of a blurred thing in front */
 vec4 b=texture(uDof,vUV);vec3 c=s;float kb=0.;if(uDofOn>.5){float dz=linz(texture(uDep,vUV).r)*dot(vec3(1.,vUV),uDofPl.xyz)-uDofPl.w,
  k=dz>0.?smoothstep(uDofB.x,uDofB.x+uDofB.y,dz):smoothstep(uDofB.x*.6,uDofB.x*.6+uDofB.z,-dz);{vec2 e=(vUV-.5)*2.;k=max(k,uDofB.w*smoothstep(.6,1.25,length(vec2(e.x,e.y*.85))));}kb=uDofOn>1.5?k:max(k,b.a);c=mix(s,b.rgb,smoothstep(.02,.4,kb));}
 if(uAOK>0.){vec2 e=uPx*1.5;float ao=texture(uAO,vUV).r*.4+(texture(uAO,vUV+vec2(e.x,e.y)).r+texture(uAO,vUV-vec2(e.x,e.y)).r+texture(uAO,vUV+vec2(e.x,-e.y)).r+texture(uAO,vUV+vec2(-e.x,e.y)).r)*.15;c*=1.-clamp(ao*uAOK,0.,.75)*(1.-uInkF.z*smoothstep(.02,.4,kb));}
 /* v33: ink outlines where depth jumps (silhouettes of props, people and billionaires), thinner with distance */
 if(uInk>0.){float d0=texture(uDep,vUV).r;if(d0<.9999){float z0=linz(d0),e=0.;vec2 q=uPx*1.;float zs[4];zs[0]=linz(texture(uDep,vUV+vec2(q.x,0)).r);zs[1]=linz(texture(uDep,vUV-vec2(q.x,0)).r);zs[2]=linz(texture(uDep,vUV+vec2(0,q.y)).r);zs[3]=linz(texture(uDep,vUV-vec2(0,q.y)).r);
  for(int i=0;i<4;i++)e=max(e,(zs[i]-z0)/z0);/* v47: one outline rule: a darker shade of the thing's own colour on props, buildings and characters; the ground (alpha 0) gets none *//* Outlines follow the camera (uInkF): fading past where the camera looks, and melting with the blur */c*=1.-uInk*step(.5,texture(uCol,vUV).a)*smoothstep(.06,.22,e)*.62*(1.-smoothstep(uInkF.x,uInkF.y,z0))*(1.-uInkF.z*smoothstep(.02,.4,kb));}}
 c+=texture(uBloom,vUV).rgb*uBloomK;if(uRaysK>0.)c+=texture(uRays,vUV).rgb*uRayC*uRaysK*.4;if(uVolK>0.){vec4 va=texture(uVol,vUV);c=c*(1.-va.a*uVolK)+va.rgb*uVolK;}
 /* v33: sun glare: a soft halo round the sun and a few ghosts along the line through the middle, only when the sun is in the open */
 if(uGlare>0.&&uSunP.z>0.){float vis=texture(uDep,clamp(uSunP.xy,.002,.998)).r>.9999?1.:0.;if(vis>0.){vec2 a=vec2(uPx.y/uPx.x,1.);vec2 sp=uSunP.xy,dv=(vUV-sp)*a;float r=length(dv);
  vec3 g=uRayC*(exp(-r*7.)*.55+exp(-r*26.)*.6)*uSunP.z;vec2 ax=(vec2(.5)-sp);for(int i=1;i<=4;i++){float f=float(i)*.42;vec2 gp=sp+ax*f*2.;float rr=length((vUV-gp)*a),sz=.025+.02*float(i);g+=uRayC*vec3(.6+.1*float(i),.75,1.)*smoothstep(sz,sz*.6,rr)*.07*uSunP.z;}
  c+=g*uGlare*vis;}}
 else if(uGlare>0.&&uSunP.z<0.){vec2 a=vec2(uPx.y/uPx.x,1.);vec2 e=clamp(uSunP.xy,-.05,1.05);float r=length((vUV-e)*a);c+=uRayC*(exp(-r*2.6)*.16+exp(-r*7.)*.1)*-uSunP.z*uGlare;}
 c=uTone>.5?mix(roll(c*uExp),film(c*uExp*1.25),uTone>1.5?1.:.85):roll(c*uExp);if(uTone>1.5)c=(c-.5)*1.08+.5;c.r*=1.+uWarm*.08;c.b*=1.-uWarm*.1;float l=dot(c,vec3(.3,.59,.11));c=mix(vec3(l),c,uSat);c=(c-.5)*uCon+.5;
 c=pow(max(c*uGain+uLift*(1.-c),0.),1./uGam);float lg=clamp(dot(c,vec3(.3,.59,.11)),0.,1.);c+=uShT*(1.-lg)*(1.-lg)+uHiT*lg*lg;
 c*=1.-uVig*pow(length(d*vec2(1.,.85))*1.25,2.6);if(uGrain>0.)c=grain(c);/* v34: a fixed half-step dither against banding in sky gradients, fog and dusk light */{vec2 q=floor(gl_FragCoord.xy);float bd=fract(52.9829189*fract(dot(q,vec2(.06711056,.00583715))));c+=(bd-.5)/255.;}
 /* CAM-3: the Studio's blur heatmap (Engine > Blur heatmap): sharp green, then yellow, then red at full blur */
 if(uDofView>.5){vec3 hm=kb<.02?vec3(.1,.85,.3):kb<.5?mix(vec3(.95,.9,.15),vec3(1.,.55,.1),kb*2.):mix(vec3(1.,.55,.1),vec3(.9,.1,.1),kb*2.-1.);c=mix(c,hm,.55);}
 o=vec4(c,1.);}`,
  ],
};
provide({ POST_EFFECT_SHADERS }); /* to-module */
/* phase 20 D2 (Engine > Quality "Medium precision", quality.mediump; engine/shader-precision.js): the post passes
   whose maths is mostly colour, with highp kept on the screen places (vUV, uPx, offsets and taps), depth and its
   linear distance (the blur's plane, the outlines), time, the sun's place on screen and every hash (grain, dither,
   the rays' jitter). The colour samplers are mediump (16-bit floats hold the HDR range), depth highp. Left highp: dof,
   dofnear and ao (depth maths nearly throughout), vol (world-space positions, the shadow maps and the fog grid),
   dofgrow (integers and one read) */
const POST_MEDIUMP = {
  bright: [
    [
      'in vec2 vUV;out vec4 o;uniform sampler2D uCol;uniform vec2 uPx;',
      'in highp vec2 vUV;out vec4 o;uniform mediump sampler2D uCol;uniform highp vec2 uPx;',
    ],
  ],
  down: [
    [
      'in vec2 vUV;out vec4 o;uniform sampler2D uCol;uniform vec2 uPx;',
      'in highp vec2 vUV;out vec4 o;uniform mediump sampler2D uCol;uniform highp vec2 uPx;',
    ],
  ],
  up: [
    [
      'in vec2 vUV;out vec4 o;uniform sampler2D uCol;uniform vec2 uPx;uniform float uR;',
      'in highp vec2 vUV;out vec4 o;uniform mediump sampler2D uCol;uniform highp vec2 uPx;uniform highp float uR;',
    ],
    ['void main(){vec2 d=uPx*uR;', 'void main(){highp vec2 d=uPx*uR;'],
  ],
  rays: [
    [
      'in vec2 vUV;out vec4 o;uniform sampler2D uCol,uDep;uniform vec2 uSun;uniform float uLen,uVirt;',
      'in highp vec2 vUV;out vec4 o;uniform mediump sampler2D uCol;uniform highp sampler2D uDep;uniform highp vec2 uSun;uniform highp float uLen;uniform float uVirt;',
    ],
    ['float h(vec2 p){', 'highp float h(highp vec2 p){'],
    ['vec3 src(vec2 q){', 'vec3 src(highp vec2 q){'],
    ['void main(){vec2 dv=(uSun-vUV);', 'void main(){highp vec2 dv=(uSun-vUV);'],
    ['vec2 q=vUV+dv*h(gl_FragCoord.xy);', 'highp vec2 q=vUV+dv*h(gl_FragCoord.xy);'],
  ],
};
for (const [k, e] of Object.entries(POST_MEDIUMP)) POST_EFFECT_SHADERS[k].mp = e;
/* a post pass: its program on target F (null: the screen) at w x h; returns the uniforms */
function postUse(name, F, w, h) {
  const gl = gpuState.gl,
    p = gpuState.P[name];
  gl.bindFramebuffer(gl.FRAMEBUFFER, F ? F.f : null);
  gl.viewport(0, 0, w, h);
  gl.useProgram(p.p);
  return p.U;
}
function postTex(U, name, unit, t) {
  const gl = gpuState.gl;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.uniform1i(U[name], unit);
}
/* draws the post chain from scene target S (color + depth) to the screen */
export function drawPostEffects(S, C, focusDist, rw, rh, o = {}) {
  const gl = gpuState.gl;
  ensurePrograms(POST_EFFECT_SHADERS);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  bindQuad();
  const F = drawDepthOfField(S, C, focusDist, rw, rh, o);
  drawPostRest(S, C, rw, rh, o, F, focusDist);
  return F;
}
/* CAM-3: the blur on its own (the diagnostics test times it apart from the rest of the post chain) */
export function drawDepthOfField(S, C, focusDist, rw, rh, o = {}) {
  const gl = gpuState.gl,
    hw = Math.max(16, rw >> 1),
    hh = Math.max(16, rh >> 1),
    use = postUse,
    tex = postTex;
  /* depth of field */
  const blur = (o.blur ?? 1) * engineSetting('lens', 'blur'),
    dofOn = blur > 0.01 && !o.noDof,
    /* CAM-3: slow phones (o.cheapDof, quality 4) get a cheap blur instead of none: two dual-Kawase steps down and
       one up (the bloom's own down and up passes), blended by the same full-size amount */
    cheap = dofOn && !!o.cheapDof,
    D = renderTarget('dof', hw, hh, { hdr: true }),
    /* the plane of focus (logic/lens-focus.js focusPlane): o.plane [g0, gx, gy, h], else facing the camera */
    pl = o.plane || [1, 0, 0, focusDist],
    dr = o.dofRef ?? C.df,
    /* the sharp band and the ramps behind and in front, in metres, and the edge blur */
    band = [
      dr * engineSetting('lens', 'focusBand'),
      dr * engineSetting('lens', 'blurFar'),
      dr * engineSetting('lens', 'blurNear'),
      engineSetting('lens', 'edgeBlur') || 0,
    ];
  if (cheap) {
    const qw = Math.max(8, hw >> 1),
      qh = Math.max(8, hh >> 1),
      K0 = renderTarget('dofk0', hw, hh, { hdr: true }),
      K1 = renderTarget('dofk1', qw, qh, { hdr: true });
    let U = use('down', K0, hw, hh);
    tex(U, 'uCol', 0, S.c);
    gl.uniform2f(U.uPx, 1 / rw, 1 / rh);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    U = use('down', K1, qw, qh);
    tex(U, 'uCol', 0, K0.c);
    gl.uniform2f(U.uPx, 1 / hw, 1 / hh);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    U = use('up', D, hw, hh);
    tex(U, 'uCol', 0, K1.c);
    gl.uniform2f(U.uPx, 1 / qw, 1 / qh);
    gl.uniform1f(U.uR, Math.min(3, 0.5 + blur));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  } else if (dofOn) {
    /* Spread blur in front (lens.nearSpread): the tiles' blur in front, then grown as far as the widest blur reaches */
    const maxR = Math.max(3, hh / (o.dofRef ? 50 : 70)) * blur,
      near = !!engineSetting('lens', 'nearSpread');
    let N = null;
    if (near) {
      const tw = Math.ceil(rw / 16),
        th = Math.ceil(rh / 16),
        T0 = renderTarget('dofnear0', tw, th),
        T1 = renderTarget('dofnear1', tw, th);
      let V = use('dofnear', T0, tw, th);
      tex(V, 'uDep', 0, S.d);
      gl.uniform1f(V.uN, C.near);
      gl.uniform1f(V.uF, C.far);
      gl.uniform4f(V.uPlane, pl[0], pl[1], pl[2], pl[3]);
      gl.uniform1f(V.uBand, band[0]);
      gl.uniform1f(V.uRampN, band[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      V = use('dofgrow', T1, tw, th);
      tex(V, 'uT', 0, T0.c);
      /* (maxR is in half-size pixels, a tile is 8 of them) */
      gl.uniform1i(V.uGrow, Math.min(4, Math.max(1, Math.ceil(maxR / 8))));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      N = T1;
    }
    const U = use('dof', D, hw, hh);
    tex(U, 'uCol', 0, S.c);
    tex(U, 'uDep', 1, S.d);
    gl.uniform2f(U.uPx, 1 / hw, 1 / hh);
    gl.uniform1f(U.uN, C.near);
    gl.uniform1f(U.uF, C.far);
    gl.uniform4f(U.uPlane, pl[0], pl[1], pl[2], pl[3]);
    gl.uniform1f(U.uBand, band[0]);
    gl.uniform1f(U.uRampF, band[1]);
    gl.uniform1f(U.uRampN, band[2]);
    gl.uniform1f(U.uEdge, band[3]);
    gl.uniform1f(U.uMaxR, maxR); /* (the walk view's blur a little wider) */
    tex(U, 'uNear', 2, N ? N.c : gpuState.white);
    gl.uniform1f(U.uNearOn, N ? 1 : 0);
    gl.uniform1f(U.uBokeh, engineSetting('lens', 'bokeh'));
    gl.uniform1i(U.uTaps, o.fast ? 14 : 28);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  return {
    D,
    dofOn,
    cheap,
    pl,
    band,
    scale: dofOn ? Math.min(1.5, o.blur ?? 1) : 0,
    path: !dofOn ? 'off' : cheap ? 'cheap' : o.fast ? 'fast' : 'full',
    nearSpread: dofOn && !cheap && !!engineSetting('lens', 'nearSpread'),
  };
}
/* the rest of the post chain: bloom, AO, shafts, light in the air, then the grade to the screen with the blur F
   (drawDepthOfField's: its target D, whether it's on, its plane and band) */
export function drawPostRest(S, C, rw, rh, o, F, focusDist = 0) {
  const { D, dofOn } = F;
  const gl = gpuState.gl,
    hw = Math.max(16, rw >> 1),
    hh = Math.max(16, rh >> 1),
    use = postUse,
    tex = postTex;
  /* bloom: bright pass at half size, down to 1/16, back up */
  const bk = engineSetting('color', 'bloom') * (o.bloom ?? 1),
    chain = [];
  let src = S.c,
    w = hw,
    h = hh;
  if (bk > 0.01) {
    let U = use('bright', renderTarget('b0', w, h, { hdr: true }), w, h);
    tex(U, 'uCol', 0, S.c);
    gl.uniform2f(U.uPx, 1 / rw, 1 / rh);
    /* Even bloom (color.bloomEven): the threshold as it reads after the exposure */
    const ev = !!engineSetting('color', 'bloomEven');
    gl.uniform1f(
      U.uT,
      engineSetting('color', 'bloomThreshold') / (ev ? Math.max(0.2, engineSetting('color', 'exposure') || 1) : 1)
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    chain.push(gpuState.fb.b0);
    for (let i = 1; i < (o.bloomN || 5); i++) {
      const pw = w,
        ph = h;
      w = Math.max(4, w >> 1);
      h = Math.max(4, h >> 1);
      const F = renderTarget('b' + i, w, h, { hdr: true });
      U = use('down', F, w, h);
      tex(U, 'uCol', 0, chain[i - 1].c);
      gl.uniform2f(U.uPx, 1 / pw, 1 / ph);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      chain.push(F);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = chain.length - 1; i > 0; i--) {
      const F = chain[i - 1],
        U2 = use('up', F, F.w, F.h);
      tex(U2, 'uCol', 0, chain[i].c);
      gl.uniform2f(U2.uPx, 1 / chain[i].w, 1 / chain[i].h);
      gl.uniform1f(U2.uR, engineSetting('color', 'bloomSize'));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.disable(gl.BLEND);
  }
  /* ambient occlusion from the depth buffer: dark creases where things meet */
  const aoK = o.noAO ? 0 : engineSetting('shadows', 'ao');
  let AO = null;
  if (aoK > 0.01) {
    AO = renderTarget('ao', hw, hh);
    const U = use('ao', AO, hw, hh);
    tex(U, 'uDep', 0, S.d);
    gl.uniform2f(U.uPx, 1 / hw, 1 / hh);
    gl.uniform1f(U.uN, C.near);
    gl.uniform1f(U.uF, C.far);
    gl.uniform1f(U.uR, engineSetting('shadows', 'aoRadius'));
    gl.uniform1f(U.uFoc, (C.F || hh) * 0.5);
    gl.uniform1f(U.uRange, Math.max(0.3, engineSetting('shadows', 'aoRadius') * 1.6));
    gl.uniform1f(U.uKind, (engineSetting('shadows', 'aoKind') || 'horizon') === 'horizon' ? 1 : 0);
    /* Occlusion follows the slope (shadows.aoPlane): measured so a plane, flat or at a slant, gives none. It still fades
       out by 36 m (reaching to where you stand, 36-58 m back, it darkened every grass blade's foot) */
    gl.uniform1f(U.uPlane, engineSetting('shadows', 'aoPlane') ? 1 : 0);
    gl.uniform2f(U.uFade, 18, 36);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  /* light shafts: the sky and the brightest spots smeared toward the sun's place on screen */
  const rk = o.sun && !o.noRays ? engineSetting('sun', 'shafts') * (o.sun[2] ?? 1) : 0;
  let RY = null;
  if (rk > 0.01) {
    const qw = Math.max(16, hw >> 1),
      qh = Math.max(16, hh >> 1);
    RY = renderTarget('rays', qw, qh, { hdr: true });
    const U = use('rays', RY, qw, qh);
    tex(U, 'uCol', 0, S.c);
    tex(U, 'uDep', 1, S.d);
    gl.uniform2f(U.uSun, o.sun[0], o.sun[1]);
    gl.uniform1f(U.uLen, engineSetting('sun', 'shaftLength'));
    gl.uniform1f(U.uVirt, o.sun[3] ? 1 : 0);
    gl.uniform1f(U.uAsp, rw / rh);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  /* v43: god rays and lamps in the air: a march through the sun's shadow maps at quarter size, then softened */
  const X = o.X,
    gk = X && !o.noVol ? (engineSetting('air', 'godRays') ?? 0.6) * (X.sun && X.sun.indoor ? 0 : 1) : 0,
    lk = X && !o.noVol ? (engineSetting('air', 'lightsInAir') ?? 0.7) : 0;
  /* AIR-3: the low fog (o.fog: the fog grid, its box, the dials and steps) has its own gate: it runs without a shadow
     map and with the shafts at 0; the shafts still need the shadow map */
  const FG = X ? o.fog : null,
    sh = !!(X && (gk > 0.01 || lk > 0.01) && X.shadow);
  let VO = null;
  if (sh || FG) {
    const qw = Math.max(16, hw >> 1),
      qh = Math.max(16, hh >> 1),
      V0 = renderTarget('vol0', qw, qh, { hdr: true });
    const U = use('vol', V0, qw, qh);
    const p = gpuState.P.vol;
    setLightUniforms(p, X);
    tex(U, 'uDep', 0, S.d);
    gl.uniformMatrix4fv(U.uIVP, false, o.ivp);
    gl.uniform1f(U.uN, C.near);
    gl.uniform1f(U.uF, C.far);
    gl.uniform1f(U.uK, sh ? gk : 0);
    gl.uniform1f(U.uLK, sh ? lk : 0);
    /* the 3D texture on its own unit (no other sampler of this program there), nothing bound when there is no fog */
    gl.activeTexture(gl.TEXTURE0 + 4);
    gl.bindTexture(gl.TEXTURE_3D, FG ? FG.tex : null);
    gl.bindSampler(4, null);
    gl.uniform1i(U.uFogT, 4);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(U.uFogK, FG ? FG.k : 0);
    if (FG) {
      const B = FG.B,
        G = FG.G;
      gl.uniform3f(U.uFogLo, B.x0, B.y0, B.z0);
      gl.uniform3f(U.uFogHi, B.x1, B.y1, B.z1);
      gl.uniform4f(U.uFogS, 1 / (G.nx * G.cell), 1 / (G.nz * G.cell), 1 / G.cell, G.oy);
      gl.uniform4f(U.uFogC, B.cx, B.cz, B.r, G.ny);
      gl.uniform1f(U.uFogLK, FG.lk);
      gl.uniform1f(U.uSteps, FG.steps);
    }
    gl.uniform1f(U.uDens, o.volDens ?? 1);
    gl.uniform1f(U.uMaxD, o.volMax || 48);
    /* phase 20 R2 (D6): how many of the lit lamps glow in the air (6, the most the march checks; 4 on a phone) */
    gl.uniform1f(U.uAirN, o.airLamps ?? 6);
    /* Rays follow the light (sun.followLight): the shade in the air is as deep as the light is bright (shallow under the moon) */
    gl.uniform1f(U.uFollow, engineSetting('sun', 'followLight') ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    VO = renderTarget('vol1', qw, qh, { hdr: true });
    const U2 = use('down', VO, qw, qh);
    tex(U2, 'uCol', 0, V0.c);
    gl.uniform2f(U2.uPx, 1 / qw, 1 / qh);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  /* grade to the screen */
  const U = use('grade', null, rw, rh);
  tex(U, 'uCol', 0, S.c);
  tex(U, 'uDof', 1, D.c);
  tex(U, 'uBloom', 2, bk > 0.01 ? chain[0].c : gpuState.white);
  gl.uniform2f(U.uPx, 1 / rw, 1 / rh);
  gl.uniform1f(U.uDofOn, !dofOn ? 0 : F.cheap ? 2 : 1);
  gl.uniform4f(U.uDofPl, F.pl[0], F.pl[1], F.pl[2], F.pl[3]);
  gl.uniform4f(U.uDofB, F.band[0], F.band[1], F.band[2], F.band[3]);
  gl.uniform1f(U.uDofView, o.dofView ? 1 : 0);
  /* Even bloom: each level the chain adds is one more copy, so fewer levels (the slower quality steps) scale up to five's */
  gl.uniform1f(U.uBloomK, bk > 0.01 ? bk * 0.6 * (engineSetting('color', 'bloomEven') ? 5 / (o.bloomN || 5) : 1) : 0);
  gl.uniform1f(U.uExp, engineSetting('color', 'exposure'));
  if (U.uTone) {
    const tm = engineSetting('color', 'tone') || 'soft';
    gl.uniform1f(U.uTone, tm === 'film' ? 1 : tm === 'punchy' ? 2 : 0);
    gl.uniform1f(U.uHeat, reducedMotion ? 0 : (o.heat || 0) * (engineSetting('air', 'heat') ?? 1));
  }
  if (U.uHeatN) {
    const hs = reducedMotion ? null : o.heatS;
    gl.uniform1f(U.uHeatN, hs ? hs.length / 4 : 0);
    if (hs && hs.length) gl.uniform4fv(U.uHeatS, hs);
  }
  gl.uniform1f(U.uShoulder, engineSetting('color', 'shoulder'));
  const MO = o.mood;
  /* CAM-3: Engine > Lens > Miniature look: saturation, contrast and vignette, as much as the blur in use */
  const mini = (engineSetting('lens', 'miniature') || 0) * F.scale;
  gl.uniform1f(U.uCon, engineSetting('color', 'contrast') * (MO ? MO.con : 1) * (1 + mini * 0.12));
  gl.uniform1f(U.uSat, engineSetting('color', 'saturation') * (MO ? MO.sat : 1) * (1 + mini * 0.25));
  gl.uniform1f(U.uWarm, engineSetting('color', 'warmth') + (MO ? MO.warm : 0));
  gl.uniform1f(U.uVig, Math.min(1, engineSetting('lens', 'vignette') + mini * 0.2));
  gl.uniform1f(U.uCA, engineSetting('lens', 'aberration'));
  gl.uniform1f(U.uGrain, reducedMotion ? 0 : engineSetting('lens', 'grain'));
  gl.uniform1f(U.uSharp, engineSetting('lens', 'sharpen'));
  gl.uniform1f(U.uTime, typeof walkView !== 'undefined' ? walkView.t : 0);
  tex(U, 'uVol', 12, VO ? VO.c : gpuState.white);
  gl.bindSampler(12, null);
  gl.uniform1f(U.uVolK, VO ? 1 : 0);
  tex(U, 'uAO', 3, AO ? AO.c : gpuState.white);
  if (U.uDep) {
    tex(U, 'uDep', 5, S.d);
    gl.uniform1f(U.uNear, C.near);
    gl.uniform1f(U.uFar, C.far);
    gl.uniform1f(U.uInk, engineSetting('color', 'ink') ?? 0.35);
    /* Outlines follow the camera (color.inkFollow): [fade from, fade to, melt with the blur] */
    const ik = !!engineSetting('color', 'inkFollow');
    gl.uniform3f(
      U.uInkF,
      ik ? Math.max(25, (focusDist || 0) * 1.4) : 25,
      ik ? Math.max(60, (focusDist || 0) * 2.4) : 60,
      ik ? 1 : 0
    );
    const sp = o.sun;
    gl.uniform3f(U.uSunP, sp ? sp[0] : 0, sp ? sp[1] : 0, sp ? sp[2] * (sp[3] ? -1 : 1) : 0);
    gl.uniform1f(U.uGlare, !sp ? 0 : (engineSetting('sun', 'glare') ?? 0.6));
  }
  gl.uniform1f(U.uAOK, AO ? aoK : 0);
  tex(U, 'uRays', 4, RY ? RY.c : gpuState.white);
  gl.uniform1f(U.uRaysK, RY ? rk : 0);
  const sc = o.sunCol || engineColor('sun', 'color', '#FFF0D8');
  gl.uniform3f(U.uRayC, sc[0], sc[1], sc[2]);
  const G = colorGrade();
  if (MO) {
    /* v47: the place's mood (data: moods) on top of the chosen grade */ for (let i = 0; i < 3; i++) {
      G.lift[i] += MO.lift[i];
      G.sh[i] += MO.sh[i];
      G.hi[i] += MO.hi[i];
      G.gain[i] *= 1 + MO.gain[i];
    }
  }
  /* 0.1.0 alpha: the time-of-day look's shadow and highlight tints (outdoors, in a walk frame) */
  const TL = engineContext.env && typeof environment !== 'undefined' ? environment.look : null;
  if (TL && TL.tintStrength > 0)
    for (let i = 0; i < 3; i++) {
      G.sh[i] += (TL.shadowTint[i] - 0.5) * 0.08 * TL.tintStrength;
      G.hi[i] += (TL.lightTint[i] - 0.5) * 0.08 * TL.tintStrength;
    }
  gl.uniform3fv(U.uLift, G.lift);
  gl.uniform3fv(U.uGam, G.gamma);
  gl.uniform3fv(U.uGain, G.gain);
  gl.uniform3fv(U.uShT, G.sh);
  gl.uniform3fv(U.uHiT, G.hi);
  gl.activeTexture(gl.TEXTURE0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.enable(gl.DEPTH_TEST);
}
/* colour grades: lift (shadows), gamma (mid-tones), gain (highlights) and tints for the darks and the lights */
const COLOR_GRADES = {
  none: { name: 'None' },
  film: {
    name: 'Warm film',
    lift: [0.012, 0.006, 0.02],
    gamma: [1.02, 1, 0.97],
    gain: [1.03, 1.005, 0.95],
    sh: [0.004, -0.004, 0.03],
    hi: [0.03, 0.015, -0.015],
  },
  teal: {
    name: 'Teal and orange',
    lift: [0, 0.02, 0.04],
    gamma: [1, 1, 1],
    gain: [1.05, 1, 0.93],
    sh: [-0.02, 0.03, 0.06],
    hi: [0.06, 0.02, -0.04],
  },
  vivid: {
    name: 'Storybook',
    lift: [0.01, 0.01, 0.02],
    gamma: [1.04, 1.04, 1.02],
    gain: [1.04, 1.04, 1.02],
    sh: [0.01, 0, 0.04],
    hi: [0.03, 0.03, 0],
  },
  faded: {
    name: 'Faded photo',
    lift: [0.08, 0.07, 0.07],
    gamma: [1, 1, 1],
    gain: [0.94, 0.93, 0.9],
    sh: [0.02, 0.01, 0],
    hi: [0.02, 0.01, -0.02],
  },
  pastel: {
    name: 'Pastel',
    lift: [0.05, 0.05, 0.06],
    gamma: [1.03, 1.03, 1.03],
    gain: [0.97, 0.97, 0.97],
    sh: [0.01, 0.02, 0.03],
    hi: [0.02, 0.01, 0.02],
  },
  crisp: {
    name: 'Crisp morning',
    lift: [0, 0.005, 0.015],
    gamma: [1.02, 1.03, 1.04],
    gain: [1.04, 1.04, 1.05],
    sh: [-0.01, 0, 0.02],
    hi: [0.01, 0.015, 0.02],
  },
  moonlit: {
    name: 'Moonlit',
    lift: [0.01, 0.015, 0.05],
    gamma: [0.96, 0.98, 1.04],
    gain: [0.92, 0.96, 1.06],
    sh: [0, 0.01, 0.05],
    hi: [-0.01, 0, 0.03],
  },
  dusk: {
    name: 'Dusk',
    lift: [0.02, 0, 0.06],
    gamma: [0.98, 0.95, 1.02],
    gain: [1.06, 0.96, 0.9],
    sh: [0.02, -0.01, 0.07],
    hi: [0.07, 0.02, -0.03],
  },
  cold: {
    name: 'Cold morning',
    lift: [0, 0.02, 0.05],
    gamma: [0.98, 1, 1.04],
    gain: [0.95, 1, 1.06],
    sh: [-0.01, 0.01, 0.05],
    hi: [-0.01, 0.01, 0.04],
  },
};
function colorGrade() {
  const g = COLOR_GRADES[engineSetting('color', 'grade')] || COLOR_GRADES.none,
    k = clamp(engineSetting('color', 'gradeAmount'), 0, 1.5),
    m = (v, d) => (v || [d, d, d]).map(x => d + (x - d) * k);
  return { lift: m(g.lift, 0), gamma: m(g.gamma, 1), gain: m(g.gain, 1), sh: m(g.sh, 0), hi: m(g.hi, 0) };
}
/* where the sun is on screen (u, v, strength); off-screen suns fade out */
/* alpha 0.4.1: the sun's place on screen. When it is off the picture (as it nearly always is, looking down on the
   world), a stand-in point far out on the side the sun shines from: [u,v,strength,1]. Light shafts then stream from
   bright places toward it and the glare becomes a soft light leak on that edge, so both dials do something from above */
export function sunScreenPosition(C, dir, far) {
  const r = projectToScreenUv(C.vp, [C.eye[0] + dir[0] * far, C.eye[1] + dir[1] * far, C.eye[2] + dir[2] * far]);
  if (r && r[2] > 0.02) return r;
  const hl = Math.hypot(dir[0], dir[2]);
  if (hl < 0.05 || dir[1] < -0.02) return null;
  const f = C.fwd || [0, 0, -1],
    c = [C.eye[0] + f[0] * 12, C.eye[1] + f[1] * 12, C.eye[2] + f[2] * 12],
    a = projectToScreenUv(C.vp, c),
    b = projectToScreenUv(C.vp, [c[0] + (dir[0] / hl) * 4, c[1], c[2] + (dir[2] / hl) * 4]);
  if (!a || !b) return null;
  let du = b[0] - a[0],
    dv = b[1] - a[1];
  const l = Math.hypot(du, dv);
  if (l < 1e-4) return null;
  du /= l;
  dv /= l;
  return [
    0.5 + du * 1.25,
    0.5 + dv * 1.25,
    clamp(0.35 + 0.65 * Math.min(1, hl * 1.5), 0, 1) * (dir[1] > 0.08 ? 1 : dir[1] / 0.08),
    1,
  ];
}
export function projectToScreenUv(m, p) {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  if (w <= 0.01) return null;
  const u = (x / w) * 0.5 + 0.5,
    v = (y / w) * 0.5 + 0.5,
    off = Math.max(0, Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) - 0.5);
  return [u, v, clamp(1 - off / 1.2, 0, 1)];
}
/* a small picture of what's on screen: copied out of the frame that drew it (works where drawImage of a WebGL canvas doesn't) */
export function screenSnapshot(rw, rh, over, max = 480) {
  const gl = gpuState.gl,
    k = Math.min(1, max / Math.max(rw, rh)),
    w = Math.max(1, Math.round(rw * k)),
    h = Math.max(1, Math.round(rh * k)),
    F = renderTarget('snap', w, h);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, F.f);
  gl.blitFramebuffer(0, 0, rw, rh, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.LINEAR);
  gl.bindFramebuffer(gl.FRAMEBUFFER, F.f);
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const c = makeCanvas(w, h),
    x = c.getContext('2d'),
    img = x.createImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  x.putImageData(img, 0, 0);
  if (over) x.drawImage(over, 0, 0, w, h);
  return c;
}
