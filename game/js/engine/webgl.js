'use strict';
/* ================= ENGINE CORE =================
   The WebGL2 foundation the walk scenes use (and, later, battles and the map): the context, math, shader building,
   textures with automatic normal maps, render targets and the shared lighting code in GLSL.
   One engine state object, gpuState, is shared by every view. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { artCacheVersion, onGlContextRestored, provide, walkRenderer } from '../hooks.js';
import { clamp } from '../util.js';
import { makeCanvas } from '../art.js';
import { imageReady } from '../walk-view.js';
import { engineSetting } from './settings.js';
/* eslint-disable no-func-assign */
expose({
  ATTRIBUTE_LOCATIONS: [() => ATTRIBUTE_LOCATIONS],
  COMMON_GLSL: [() => COMMON_GLSL],
  LIGHT_GLSL: [() => LIGHT_GLSL],
  LOOK_GLSL: [() => LOOK_GLSL],
  NORMAL_MAP_WORKER_SOURCE: [() => NORMAL_MAP_WORKER_SOURCE],
  SURFACE_MATERIALS: [() => SURFACE_MATERIALS],
  applyAnisotropy: [() => applyAnisotropy, v => (applyAnisotropy = v)],
  attributeClashes: [() => attributeClashes, v => (attributeClashes = v)],
  beginGpuTimer: [() => beginGpuTimer, v => (beginGpuTimer = v)],
  bindGridQuad: [() => bindGridQuad, v => (bindGridQuad = v)],
  bindQuad: [() => bindQuad, v => (bindQuad = v)],
  compileProgram: [() => compileProgram, v => (compileProgram = v)],
  cross3: [() => cross3],
  endGpuTimer: [() => endGpuTimer, v => (endGpuTimer = v)],
  ensureNormalMapWorker: [() => ensureNormalMapWorker, v => (ensureNormalMapWorker = v)],
  ensurePrograms: [() => ensurePrograms, v => setEnsurePrograms(v)],
  finishProgramCompile: [() => finishProgramCompile, v => setFinishProgramCompile(v)],
  freeMesh: [() => freeMesh, v => (freeMesh = v)],
  gpuState: [() => gpuState],
  imageTexture: [() => imageTexture, v => (imageTexture = v)],
  initWebgl: [() => initWebgl, v => (initWebgl = v)],
  makeNormalMap: [() => makeNormalMap, v => setMakeNormalMap(v)],
  matrix4: [() => matrix4],
  normalMapWorkerState: [() => normalMapWorkerState],
  normalize3: [() => normalize3],
  pollGpuTimers: [() => pollGpuTimers, v => (pollGpuTimers = v)],
  pollPendingPrograms: [() => pollPendingPrograms, v => (pollPendingPrograms = v)],
  precompilePrograms: [() => precompilePrograms, v => (precompilePrograms = v)],
  renderTarget: [() => renderTarget, v => (renderTarget = v)],
  runNormalMapJobs: [() => runNormalMapJobs, v => setRunNormalMapJobs(v)],
  setTextureParams: [() => setTextureParams, v => (setTextureParams = v)],
  smooth01: [() => smooth01],
  startProgramCompile: [() => startProgramCompile, v => (startProgramCompile = v)],
  textureFromData: [() => textureFromData, v => (textureFromData = v)],
  trackTexture: [() => trackTexture, v => (trackTexture = v)],
  trimTextures: [() => trimTextures, v => (trimTextures = v)],
  uploadMesh: [() => uploadMesh, v => (uploadMesh = v)],
  webgl2Supported: [() => webgl2Supported, v => (webgl2Supported = v)],
  windBendAt: [() => windBendAt, v => (windBendAt = v)],
  windGustAt: [() => windGustAt, v => (windGustAt = v)],
});
/* eslint-enable no-func-assign */
export function setEnsurePrograms(v) {
  ensurePrograms = v; // eslint-disable-line no-func-assign
  provide({ ensurePrograms });
}
export function setFinishProgramCompile(v) {
  finishProgramCompile = v; // eslint-disable-line no-func-assign
  provide({ finishProgramCompile });
}
export function setMakeNormalMap(v) {
  makeNormalMap = v; // eslint-disable-line no-func-assign
  provide({ makeNormalMap });
}
export function setRunNormalMapJobs(v) {
  runNormalMapJobs = v; // eslint-disable-line no-func-assign
  provide({ runNormalMapJobs });
}
/* to-module: end */
export const gpuState = {
  ok: null,
  gl: null,
  cv: null,
  P: {},
  tex: new WeakMap(),
  white: null,
  flatN: null,
  quad: null,
  fb: {},
  hdr: false,
  samp: {},
  normQ: [],
  lost: 0,
  fail: 0,
};
export function webgl2Supported() {
  if (gpuState.ok != null) return gpuState.ok;
  try {
    const c = document.createElement('canvas');
    gpuState.ok = !!c.getContext('webgl2');
  } catch (e) {
    gpuState.ok = false;
  }
  return gpuState.ok;
}
/* ---------- math (column-major 4×4) ---------- */
export const matrix4 = {
  mul(a, b) {
    const o = new Float32Array(16);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
        o[i * 4 + j] = s;
      }
    return o;
  },
  persp(fy, asp, n, f) {
    const t = 1 / Math.tan(fy / 2),
      o = new Float32Array(16);
    o[0] = t / asp;
    o[5] = t;
    o[10] = (f + n) / (n - f);
    o[11] = -1;
    o[14] = (2 * f * n) / (n - f);
    return o;
  },
  ortho(l, r, b, t, n, f) {
    const o = new Float32Array(16);
    o[0] = 2 / (r - l);
    o[5] = 2 / (t - b);
    o[10] = -2 / (f - n);
    o[12] = -(r + l) / (r - l);
    o[13] = -(t + b) / (t - b);
    o[14] = -(f + n) / (f - n);
    o[15] = 1;
    return o;
  },
  look(e, c, u) {
    const z = normalize3([e[0] - c[0], e[1] - c[1], e[2] - c[2]]),
      x = normalize3(cross3(u, z)),
      y = cross3(z, x),
      o = new Float32Array(16);
    o[0] = x[0];
    o[4] = x[1];
    o[8] = x[2];
    o[1] = y[0];
    o[5] = y[1];
    o[9] = y[2];
    o[2] = z[0];
    o[6] = z[1];
    o[10] = z[2];
    o[12] = -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]);
    o[13] = -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]);
    o[14] = -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]);
    o[15] = 1;
    return o;
  },
  inv(m) {
    const a = m,
      o = new Float32Array(16),
      b00 = a[0] * a[5] - a[1] * a[4],
      b01 = a[0] * a[6] - a[2] * a[4],
      b02 = a[0] * a[7] - a[3] * a[4],
      b03 = a[1] * a[6] - a[2] * a[5],
      b04 = a[1] * a[7] - a[3] * a[5],
      b05 = a[2] * a[7] - a[3] * a[6],
      b06 = a[8] * a[13] - a[9] * a[12],
      b07 = a[8] * a[14] - a[10] * a[12],
      b08 = a[8] * a[15] - a[11] * a[12],
      b09 = a[9] * a[14] - a[10] * a[13],
      b10 = a[9] * a[15] - a[11] * a[13],
      b11 = a[10] * a[15] - a[11] * a[14];
    let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!d) return o;
    d = 1 / d;
    o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d;
    o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d;
    o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d;
    o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
    o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d;
    o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d;
    o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d;
    o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
    o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d;
    o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d;
    o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d;
    o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
    o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d;
    o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d;
    o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * d;
    o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d;
    return o;
  },
};
export const normalize3 = a => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const smooth01 = t => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
provide({ smooth01 }); /* to-module */
/* ---------- shared GLSL ---------- */
export const COMMON_GLSL = `
uniform vec3 uCurve;uniform float uCurveD0;
float curveY(vec2 p){float d=max(0.,length(p-uCurve.xy)-uCurveD0);return uCurve.z*d*d;}
float windGust(vec2 p,float t){float a=sin(p.x*.35+p.y*.21-t*.0018)*.5+.5;float band=pow(max(0.,sin(p.x*.11+p.y*.06-t*.00055)),8.);return a*a+band*1.3;}
float windBend(vec2 p,float t,float g){return .07*sin(t*.000625+p.x*.45+p.y*.3)+.035*sin(t*.0023+p.x*1.7+p.y*1.1)+.012*sin(t*.0071+p.x*3.1)+.08*windGust(p,t)*g;}
`;
/* the same wind for things moved on the CPU (trees, bushes, leaves): one field, so gusts roll across grass and trees together */
export function windGustAt(x, z, t) {
  const a = Math.sin(x * 0.35 + z * 0.21 - t * 0.0018) * 0.5 + 0.5,
    band = Math.pow(Math.max(0, Math.sin(x * 0.11 + z * 0.06 - t * 0.00055)), 8);
  return a * a + band * 1.3;
}
/* alpha 0.4: one wind for a whole place: the slow sway, the quicker flutter and the gusts rolling across, the same field
   for every blade of grass (GLSL windBend), every swaying prop and every tree, so they all bend together */
export function windBendAt(x, z, t, g) {
  return (
    0.07 * Math.sin(t * 0.000625 + x * 0.45 + z * 0.3) +
    0.035 * Math.sin(t * 0.0023 + x * 1.7 + z * 1.1) +
    0.012 * Math.sin(t * 0.0071 + x * 3.1) +
    0.08 * windGustAt(x, z, t) * g
  );
}
/* lighting shared by everything lit in the world: sun with soft contact-hardening shadows and cloud shadows, contact
   occlusion, point lights (window lights only light what is in front of them), sky and ground ambient, haze and mist */
export const LIGHT_GLSL = `
uniform vec3 uEye,uSunDir,uSunCol,uAmbTop,uAmbBot,uFogCol,uTint,uShTint;
uniform vec4 uRoomB;uniform float uRoomDim;
uniform vec2 uValley;uniform float uFogStart,uFogD,uTintAmt,uMist,uMistY,uTime,uShStr,uShPen,uCloudSh,uCloudSpd,uCloudCov,uContact,uAmbK,uShLite,uShPx;uniform vec3 uShLift;
uniform highp sampler2DShadow uShadow;uniform highp sampler2D uShadowD;uniform mat4 uShadowM;uniform float uShadowOn;uniform vec2 uShadowTexel;
uniform highp sampler2DShadow uShadow2;uniform highp sampler2D uShadowD2;uniform mat4 uShadowM2;uniform float uShadow2On,uShPen2;uniform vec2 uShadowTexel2;
uniform vec4 uLP[16];uniform vec4 uLC[16];uniform int uNL;
uniform highp sampler2DShadow uLampSh0,uLampSh1;uniform mat4 uLampM0,uLampM1;uniform int uNLS;
uniform vec4 uAO[64];uniform int uNAO;
uniform vec4 uSeason;uniform vec2 uFol;
uniform vec3 uSH[9];uniform float uSHK,uFogSun;
const vec2 PD[12]=vec2[12](vec2(-.326,-.406),vec2(-.840,-.074),vec2(-.696,.457),vec2(-.203,.621),vec2(.962,-.195),vec2(.473,-.480),vec2(.519,.767),vec2(.185,-.893),vec2(.507,.064),vec2(.896,.412),vec2(-.322,-.933),vec2(-.792,-.598));
float lhash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float lnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(lhash(i),lhash(i+vec2(1,0)),f.x),mix(lhash(i+vec2(0,1)),lhash(i+vec2(1,1)),f.x),f.y);}
float cloudShade(vec3 p){if(uCloudSh<=0.)return 1.;vec2 q=p.xz*.045+vec2(uTime,uTime*.6)*.000012*uCloudSpd;float n=lnoise(q)*.65+lnoise(q*2.3+7.)*.35;float e=.72-uCloudCov*.34;return 1.-uCloudSh*smoothstep(e,e+.2,n);}/* alpha 0.4.1: the Clouds dial sets how much of the ground the cloud shadows cover */
/* v19: pixel-art shadows. The lookup point is snapped to the world's pixel grid within its own surface (so edges step
   in whole pixels like the art, and nothing slips into the surface), and the soft edge is stepped into three tones with
   an ordered dither, the way a pixel artist shades a penumbra. uShPx is pixels per metre; 0 keeps the smooth shadows. */
float shBayer(vec2 p){ivec2 i=ivec2(mod(p,4.));int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i.y*4+i.x])+.5)/16.;}
float shadowAtN(vec3 p,vec3 n,float bias){if(uShadowOn<.5)return cloudShade(p);vec2 cell=vec2(0.);
 if(uShPx>0.){vec3 q=(floor(p*uShPx)+.5)/uShPx,d=q-p;d-=n*dot(d,n);p+=d;vec3 cc=floor(p*uShPx);cell=abs(n.y)>.6?cc.xz:abs(n.x)>abs(n.z)?cc.zy:cc.xy;}
 vec4 q=uShadowM*vec4(p,1.);vec3 c=q.xyz/q.w*.5+.5;
 /* v43: outside the near map, the far cascade (coarser, fewer taps) */
 if(c.x<.01||c.y<.01||c.x>.99||c.y>.99||c.z>1.){if(uShadow2On<.5)return cloudShade(p);vec4 q2=uShadowM2*vec4(p,1.);vec3 c2=q2.xyz/q2.w*.5+.5;if(c2.x<0.||c2.y<0.||c2.x>1.||c2.y>1.||c2.z>1.)return cloudShade(p);
  float rot2=lhash(c2.xy*913.)*6.283;mat2 R2=mat2(cos(rot2),sin(rot2),-sin(rot2),cos(rot2));float s2=0.;for(int i=0;i<6;i++){s2+=texture(uShadow2,vec3(c2.xy+R2*PD[i]*uShadowTexel2*2.2,c2.z-bias*1.5));}s2/=6.;if(uShPx>0.)s2=clamp(floor(s2*2.+shBayer(cell)),0.,2.)*.5;return mix(1.,s2,uShStr)*cloudShade(p);}
 float rot=lhash(c.xy*913.)*6.283;mat2 R=mat2(cos(rot),sin(rot),-sin(rot),cos(rot));
 int nb=uShLite>.5?4:8,np=uShLite>.5?6:12;float bs=0.,bn=0.;for(int i=0;i<8;i++){if(i>=nb)break;float d=texture(uShadowD,c.xy+R*PD[i]*uShadowTexel*7.).r;if(d<c.z-bias){bs+=d;bn+=1.;}}
 if(bn<.5)return cloudShade(p);
 float r=clamp((c.z-bs/bn)*uShPen,1.2,uShPx>0.?8.:14.);float s=0.;for(int i=0;i<12;i++){if(i>=np)break;s+=texture(uShadow,vec3(c.xy+R*PD[i]*uShadowTexel*r,c.z-bias));}
 s/=float(np);if(uShPx>0.)s=clamp(floor(s*2.+shBayer(cell)),0.,2.)*.5;
 return mix(1.,s,uShStr)*cloudShade(p);}
float shadowAt(vec3 p,float bias){return shadowAtN(p,vec3(0.,1.,0.),bias);}
float contactAO(vec3 p){float a=1.;for(int i=0;i<64;i++){if(i>=uNAO)break;vec4 b=uAO[i];vec2 d=(p.xz-b.xy)/b.zw;float e=dot(d,d);if(e<1.){float k=1.-e;a=min(a,1.-k*k*uContact);}}return a;}
/* v43: the two nearest lamps have shadow maps of their own (light.js beginLampShadow) */
float lampVis(int i,vec3 p){vec4 q=(i==0?uLampM0:uLampM1)*vec4(p,1.);if(q.w<=.01)return 1.;vec3 c=q.xyz/q.w*.5+.5;if(c.x<0.||c.y<0.||c.x>1.||c.y>1.||c.z>1.)return 1.;float s=i==0?texture(uLampSh0,vec3(c.xy,c.z-.0025)):texture(uLampSh1,vec3(c.xy,c.z-.0025));return .25+.75*s;}
vec3 points(vec3 p,vec3 n){vec3 a=vec3(0.);for(int i=0;i<16;i++){if(i>=uNL)break;vec4 L=uLP[i];vec3 d=L.xyz-p;float l=length(d),r=abs(L.w),x=clamp(l/r,0.,1.);float f=1.-x*x;f=f*f/(1.+l*l*.6);
 if(L.w<0.&&p.z>L.z+.3)f=0.;if(i<uNLS&&f>0.)f*=lampVis(i,p);a+=uLC[i].rgb*f*(.3+.7*max(dot(n,d/max(l,.001)),0.));}return a;}
/* in shadow the light takes the shadow colour, with a little coloured bounce so shade never turns to mud */
/* v43: the ambient light as nine spherical-harmonic terms of the sky, the ground's bounce and a broad warm lobe on the
   sun's side (light.js skyHarmonics): a face turned to the sky is sky-coloured, one turned down takes the ground's bounce,
   one turned toward the sun is warmer, even in shade */
vec3 shAmb(vec3 n){float x=n.x,y=n.y,z=n.z;vec3 e=.429043*uSH[8]*(x*x-y*y)+.743125*uSH[6]*z*z+.886227*uSH[0]-.247708*uSH[6]+.858086*(uSH[4]*x*y+uSH[7]*x*z+uSH[5]*y*z)+1.023328*(uSH[3]*x+uSH[1]*y+uSH[2]*z);return max(e*.3183,vec3(0.));}
vec3 ambient(vec3 n,float occ,float sh){vec3 a=mix(mix(uAmbBot,uAmbTop,n.y*.5+.5),shAmb(n),uSHK)*uAmbK*occ;return a*mix(uShTint,vec3(1.),sh)+uShLift*(1.-sh)*occ;}
/* v43: one shading for every surface in the world. Albedo a at p with normal n, in shadow sh (0 dark .. 1 lit) and
   occlusion ao; mat = (specular, shininess, translucency, wrap); wrapK softens the terminator (leaves, cloth);
   cel > 0 quantises the sun into three tones (voxels). The pieces: the sky-shaped ambient (shadow-tinted in shade),
   the sun, the lamps (with their own shadow maps) and a Blinn-Phong highlight. Rim, translucency and emissive stay
   with the shaders that want them. */
vec3 shade(vec3 a,vec3 n,vec3 p,float sh,float ao,vec4 mat,float cel){float occ=min(sh,ao);vec3 amb=ambient(n,ao,occ);
 float nl=dot(n,uSunDir),wr=(nl+mat.w)/(1.+mat.w),dif=max(wr,0.);if(cel>0.)dif=mix(dif,nl>.45?1.:nl>.05?.62:.3,cel);
 vec3 v=normalize(uEye-p);float spc=pow(max(dot(n,normalize(uSunDir+v)),0.),max(1.,mat.y))*mat.x*occ;
 return a*(amb+uSunCol*dif*occ+points(p+n*.1,n))+uSunCol*spc;}
/* v26: the season on living green (uFol.x: how much this surface is leaves or grass): autumn gold and red, fresh spring
   green, pale winter; uFol.y lets snow lie on what faces up */
vec3 seasonal(vec3 c,vec3 p){if(uFol.x<=0.||uSeason.x+uSeason.y+uSeason.z<=0.)return c;float g=clamp((c.g-max(c.r,c.b))*5.,0.,1.);if(g<=0.)return c;float l=dot(c,vec3(.3,.59,.11));
 /* v31: grass on the ground (uFol.x below .9) only dries a little in autumn; leaves (uFol.x 1) turn gold, orange or red,
    one mix per tree (p is the tree's own position) with a little variety across its crown */
 if(uFol.x<.9){float k=g*uFol.x;vec3 au=mix(c,vec3(l*1.16,l*1.07,l*.62),.42);vec3 wi=mix(c,vec3(l*1.0,l*1.04,l*1.02)*1.04,.5);vec3 sp=c*vec3(1.02,1.07,.95);
  vec3 r=mix(c,sp,uSeason.y);r=mix(r,au,uSeason.x);r=mix(r,wi,uSeason.z);return mix(c,r,k);}
 float v=fract(sin(dot(floor(p.xz*1.7),vec2(12.9898,78.233)))*43758.5453),w=clamp(v*.85+(l-.35)*.6,0.,1.);
 vec3 au=(w<.4?mix(vec3(1.62,1.18,.34),vec3(1.66,.92,.3),w/.4):mix(vec3(1.66,.92,.3),vec3(1.5,.5,.3),(w-.4)/.6))*l*1.06;vec3 wi=vec3(l*.98,l*1.04,l*1.02)*1.08;vec3 sp=c*vec3(1.03,1.1,.92);
 vec3 r=mix(c,sp,uSeason.y);r=mix(r,au,uSeason.x);r=mix(r,wi,uSeason.z);return mix(c,r,g);}
vec3 snowOn(vec3 c,vec3 p,float up){if(uSeason.w<=0.||uFol.y<=0.)return c;float s=uSeason.w*uFol.y*smoothstep(.45,.85,up)*smoothstep(.25,.65,lnoise(p.xz*1.9)+uSeason.w*.55);return mix(c,vec3(.9,.93,.98)*(.94+.06*lnoise(p.xz*11.)),clamp(s,0.,1.));}
vec3 fogit(vec3 c,vec3 p){float d=length(p-uEye);float f=1.-exp(-max(0.,d-uFogStart)/uFogD*1.6);
 float m=uMist*exp(-max(0.,p.y-uMistY)*1.4)*smoothstep(4.,22.,d)*(.55+.45*sin(p.x*.21+uTime*.00012)*sin(p.z*.17-uTime*.0001));f=clamp(f+m*(1.-f),0.,1.);
 /* v23: mist lying in a gorge or valley */
 if(uValley.y>0.){float v=uValley.y*smoothstep(0.,1.4,uValley.x-p.y)*smoothstep(1.5,9.,d)*(.62+.38*sin(p.x*.33+uTime*.00015)*sin(p.z*.27-uTime*.00011));f=clamp(f+v*.6*(1.-f),0.,1.);}
 c=mix(c,c*uTint,uTintAmt);
 /* v46: inside a building the town around the room is seen dimly (the room box, x0 z0 x1 z1) */
 if(uRoomDim>.001){float ob=max(max(uRoomB.x-p.x,p.x-uRoomB.z),max(uRoomB.y-p.z,p.z-uRoomB.w));float k=smoothstep(.05,.9,ob);float l=dot(c,vec3(.3,.59,.11));c=mix(c,mix(c,vec3(l)*vec3(.92,.95,1.08),.4*uRoomDim)*(1.-uRoomDim),k);}
 /* v43: the air takes the sun's colour where you look toward the sun (forward scattering), the sky's elsewhere */
 vec3 vd=(p-uEye)/max(d,.001);float toSun=pow(max(dot(vd,uSunDir),0.),6.);vec3 fc=mix(uFogCol,uFogCol*.45+uSunCol*.7,toSun*uFogSun);
 return mix(c,fc,f);}
`;
/* v32: every thing's own look, on top of its picture: a colour variation (hue, saturation and value shifted only in
   the colourful parts, and only within a hue window when the prop says so: leaves, not the trunk), a tint, and wear
   and tear (faded paint, dirt streaks running down and splashed at the foot, moss, hairline cracks). px is the
   position in the picture's own pixels, so the wear is as blocky as the art; hgt runs 0 at the foot to 1 at the top. */
export const LOOK_GLSL = `
uniform vec4 uWear,uHsv,uLkTint;uniform vec2 uMaskH;
vec3 lkHsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);return vec3(abs(q.z+(q.w-q.y)/(6.*d+1e-10)),d/(q.x+1e-10),q.x);}
vec3 lkRgb(vec3 c){vec3 p=abs(fract(c.xxx+vec3(1.,2./3.,1./3.))*6.-3.);return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);}
vec3 lookOn(vec3 c,vec2 px,float hgt,vec3 bp){
 if(uHsv.w>.5){vec3 h=lkHsv(c);float m=smoothstep(.14,.3,h.y)*smoothstep(.06,.18,h.z);if(uMaskH.y>0.){float dh=abs(fract(h.x-uMaskH.x+.5)-.5);m*=1.-smoothstep(uMaskH.y,uMaskH.y+.05,dh);}
  h.x=fract(h.x+uHsv.x*m);h.y=clamp(h.y*(1.+uHsv.y*m),0.,1.);h.z=clamp(h.z*(1.+uHsv.z*m),0.,1.);c=lkRgb(h);}
 float l=dot(c,vec3(.3,.59,.11)),paint=smoothstep(.09,.2,l)*(1.-smoothstep(.88,.98,l));
 if(uLkTint.w>0.)c=mix(c,c*uLkTint.rgb*1.7,uLkTint.w*paint);
 if(uWear.x+uWear.y+uWear.z+uWear.w>.001){float sd=fract(dot(bp,vec3(1.7,3.1,2.3)))*97.;
  c=mix(c,mix(vec3(l),c,.5)*1.06+.05,uWear.z*paint*.75);
  float col=fract(sin(floor(px.x*.5)*91.7+sd)*43758.5),streak=smoothstep(.62,1.,col)*smoothstep(.25,.9,lnoise(vec2(px.x*.5,px.y*.07)+sd))*(.45+.55*(1.-hgt));
  float foot=1.-smoothstep(0.,.16,hgt);c*=1.-uWear.x*(.34*streak+.3*foot)*paint;
  float mn=lnoise(px*.11+sd)*.7+lnoise(px*.31+sd*2.)*.3,moss=smoothstep(.56,.72,mn+foot*.45-hgt*.15)*uWear.y*paint;c=mix(c,vec3(.3,.42,.16)*(.75+.5*l),clamp(moss,0.,1.)*.8);
  float cr=abs(lnoise(px*vec2(.09,.13)+sd*3.)-.5);c*=1.-uWear.w*(1.-smoothstep(0.,.022,cr))*.6*paint;}
 return c;}
`;
/* ---------- programs ---------- */
/* v32: compiling is split in two: start (the GPU driver can work on it in the background) and finish (read the result).
   Shader sets that are needed later (buildings, solid props, the map) are started when a scene opens and finished a
   few at a time, so the first frame with a building in it no longer stalls while they compile. */
function startProgramCompile([vs, fs], name) {
  const gl = gpuState.gl,
    mk = (t, src) => {
      const s = gl.createShader(t);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
  const p = gl.createProgram(),
    a = mk(gl.VERTEX_SHADER, vs),
    b = mk(gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, a);
  gl.attachShader(p, b);
  [
    ['aPos', 0],
    ['aC', 0],
    ['aNrm', 1],
    ['aShore', 1],
    ['aI', 1],
    ['aCol', 2],
    ['aUV', 2],
  ].forEach(([n, l]) => {
    if (
      new RegExp('in\\s+\\w+\\s+' + n + '\\b').test(vs) &&
      !new RegExp('layout\\s*\\([^)]*\\)\\s*in\\s+\\w+\\s+' + n + '\\b').test(vs)
    )
      gl.bindAttribLocation(p, l, n);
  });
  gl.linkProgram(p);
  return { p, a, b, name, gl };
}
export function finishProgramCompile(j) {
  const gl = gpuState.gl,
    p = j.p;
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const e =
      (gl.getShaderParameter(j.a, gl.COMPILE_STATUS) ? '' : gl.getShaderInfoLog(j.a)) +
        (gl.getShaderParameter(j.b, gl.COMPILE_STATUS) ? '' : gl.getShaderInfoLog(j.b)) || gl.getProgramInfoLog(p);
    throw new Error(j.name + ': ' + e);
  }
  const U = {},
    n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const u = gl.getActiveUniform(p, i),
      nm = u.name.replace(/\[0\]$/, '');
    U[nm] = gl.getUniformLocation(p, u.name);
  }
  return { p, U, name: j.name };
}
export function precompilePrograms(defs) {
  if (!gpuState.gl || !defs) return;
  gpuState.pend = gpuState.pend || new Map();
  for (const [k, v] of Object.entries(defs))
    if (!gpuState.P[k] && !gpuState.pend.has(k))
      try {
        gpuState.pend.set(k, startProgramCompile(v, k));
      } catch (e) {}
}
export function pollPendingPrograms(max = 2) {
  const M = gpuState.pend;
  if (!M || !M.size) return;
  const gl = gpuState.gl,
    X = gpuState.pcx === undefined ? (gpuState.pcx = gl.getExtension('KHR_parallel_shader_compile')) : gpuState.pcx;
  let n = 0;
  for (const [k, j] of M) {
    if (j.gl !== gl) {
      M.delete(k);
      continue;
    }
    if (X && !gl.getProgramParameter(j.p, X.COMPLETION_STATUS_KHR)) continue;
    M.delete(k);
    try {
      if (!gpuState.P[k]) gpuState.P[k] = finishProgramCompile(j);
    } catch (e) {}
    if (++n >= max) break;
  }
}
function compileProgram([vs, fs], name) {
  const gl = gpuState.gl,
    mk = (t, src) => {
      const s = gl.createShader(t);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(name + ': ' + gl.getShaderInfoLog(s));
      return s;
    };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  /* standard locations for the engine's own inputs; an input that declares layout(location=…) keeps its own (some
    GPUs, Adreno for one, refuse to link when a bound location clashes with another input's) */
  [
    ['aPos', 0],
    ['aC', 0],
    ['aNrm', 1],
    ['aShore', 1],
    ['aI', 1],
    ['aCol', 2],
    ['aUV', 2],
  ].forEach(([n, l]) => {
    if (
      new RegExp('in\\s+\\w+\\s+' + n + '\\b').test(vs) &&
      !new RegExp('layout\\s*\\([^)]*\\)\\s*in\\s+\\w+\\s+' + n + '\\b').test(vs)
    )
      gl.bindAttribLocation(p, l, n);
  });
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(name + ': ' + gl.getProgramInfoLog(p));
  const U = {},
    n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const u = gl.getActiveUniform(p, i),
      nm = u.name.replace(/\[0\]$/, '');
    U[nm] = gl.getUniformLocation(p, u.name);
  }
  return { p, U, name };
}
/* the input locations a vertex shader ends up with (its own layout(location=…), else the engine's standard one);
   two inputs on one location is a link error on some GPUs (Adreno) that others forgive, so the full test checks it */
const ATTRIBUTE_LOCATIONS = { aPos: 0, aC: 0, aNrm: 1, aShore: 1, aI: 1, aCol: 2, aUV: 2 };
export function attributeClashes(vs) {
  const used = {},
    bad = [];
  const re = /(layout\s*\(\s*location\s*=\s*(\d+)\s*\)\s*)?in\s+\w+\s+(\w+)\s*;/g;
  let m;
  while ((m = re.exec(vs))) {
    const name = m[3],
      loc = m[2] != null ? +m[2] : ATTRIBUTE_LOCATIONS[name];
    if (loc == null) continue;
    if (m[2] != null && ATTRIBUTE_LOCATIONS[name] != null && +m[2] !== ATTRIBUTE_LOCATIONS[name])
      bad.push(`${name} sets location ${m[2]}, the engine’s standard is ${ATTRIBUTE_LOCATIONS[name]}`);
    if (used[loc] != null && used[loc] !== name) bad.push(`${used[loc]} and ${name} both on ${loc}`);
    used[loc] = name;
  }
  return bad;
}
export function ensurePrograms(defs) {
  for (const [k, v] of Object.entries(defs))
    if (!gpuState.P[k]) {
      const j = gpuState.pend && gpuState.pend.get(k);
      if (j && j.gl === gpuState.gl) {
        gpuState.pend.delete(k);
        try {
          gpuState.P[k] = finishProgramCompile(j);
          continue;
        } catch (e) {}
      }
      gpuState.P[k] = compileProgram(v, k);
    }
}
/* ---------- context ---------- */
export function initWebgl(cv) {
  try {
    const gl = cv.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) return false;
    gpuState.gl = gl;
    gpuState.cv = cv;
    gpuState.P = {};
    gpuState.texL = new Map();
    gpuState.texB = 0;
    gpuState.gpuX = undefined;
    gpuState.gpuQ = [];
    gpuState.gpuOpen = false;
    gpuState.pend = new Map();
    gpuState.pcx = undefined;
    if (typeof normalMapWorkerState !== 'undefined') {
      normalMapWorkerState.jobs.clear();
      normalMapWorkerState.fly = 0;
    }
    gpuState.fb = {};
    gpuState.tex = new WeakMap();
    gpuState.normQ = [];
    gpuState.hdr = !!gl.getExtension('EXT_color_buffer_float');
    gpuState.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    gpuState.anisoMax = gpuState.aniso ? gl.getParameter(gpuState.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;
    gl.getExtension('OES_texture_float_linear');
    const q = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, q);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    gpuState.quad = q;
    gpuState.white = textureFromData(1, 1, new Uint8Array([255, 255, 255, 255]));
    gpuState.flatN = textureFromData(1, 1, new Uint8Array([128, 128, 255, 255]));
    /* one depth texture read two ways: compared (soft shadow taps) and raw (blocker search) */
    /* a 1x1 "lit everywhere" depth map stands in on every shadow unit while no real map exists (shadows off, the first
     frames): a shadow sampler must always see a depth texture, or the whole draw is refused (v44) */
    gpuState.depthStub = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, gpuState.depthStub);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT16, 1, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gpuState.samp.cmp = gl.createSampler();
    gl.samplerParameteri(gpuState.samp.cmp, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.samplerParameteri(gpuState.samp.cmp, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.samplerParameteri(gpuState.samp.cmp, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.samplerParameteri(gpuState.samp.cmp, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.samplerParameteri(gpuState.samp.cmp, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.samplerParameteri(gpuState.samp.cmp, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gpuState.samp.raw = gl.createSampler();
    gl.samplerParameteri(gpuState.samp.raw, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.samplerParameteri(gpuState.samp.raw, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.samplerParameteri(gpuState.samp.raw, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.samplerParameteri(gpuState.samp.raw, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    cv.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      gpuState.lost = 1;
      if (typeof debugLog !== 'undefined') debugLog.add('webgl', 'context lost');
    });
    cv.addEventListener('webglcontextrestored', () => {
      gpuState.lost = 0;
      gpuState.cv = null;
      if (typeof debugLog !== 'undefined') debugLog.add('webgl', 'context restored');
      if (typeof onGlContextRestored === 'function') onGlContextRestored(cv);
    });
    if (typeof debugLog !== 'undefined') debugLog.add('webgl', `ready${gpuState.hdr ? ' (HDR)' : ''}`);
    return true;
  } catch (e) {
    console.error('WebGL engine unavailable, using the canvas renderer:', e);
    if (typeof debugLog !== 'undefined') debugLog.add('webgl', 'failed: ' + (e.message || e));
    gpuState.fail = 1;
    return false;
  }
}
/* ---------- textures ---------- */
function textureFromData(w, h, data, o = {}) {
  const gl = gpuState.gl,
    t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  setTextureParams(o);
  return t;
}
export function setTextureParams(o = {}) {
  const gl = gpuState.gl,
    f = o.linear ? gl.LINEAR : gl.NEAREST,
    wr = o.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, o.mip ? gl.LINEAR_MIPMAP_LINEAR : f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
  if (o.mip) gl.generateMipmap(gl.TEXTURE_2D);
}
/* an image or canvas as a texture. Small or far sprites use mipmaps (no shimmer); a soft normal map ("pillow" shading
   from the outline) is made in the background, a few per frame, so a new scene never freezes */
export function imageTexture(im, o = {}) {
  if (!imageReady(im)) return null;
  const v = typeof artCacheVersion === 'function' ? artCacheVersion() : 0,
    dv = im.__v;
  let e = gpuState.tex.get(im);
  if (e && e.v === v && e.dv === dv) {
    e.u = gpuState.fr || 0;
    return e;
  }
  /* a canvas redrawn every frame (a billionaire mid-animation) carries a counter in __v: re-uploaded when it changes, no mipmaps or normal map */
  if (dv !== undefined) {
    const gl = gpuState.gl,
      t = e ? e.t : gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
    setTextureParams({});
    const ne = { t, n: gpuState.flatN, w: im.width, h: im.height, v, dv, im, nDone: true };
    gpuState.tex.set(im, ne);
    return ne;
  }
  const gl = gpuState.gl,
    w = im.naturalWidth || im.width,
    h = im.naturalHeight || im.height;
  const tU = performance.now(),
    t = e ? e.t : gl.createTexture(),
    src = im;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, o.repeat ? gl.NEAREST : gl.NEAREST_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const wr = o.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
  if (!o.repeat) gl.generateMipmap(gl.TEXTURE_2D);
  /* v32: props seen at a slant (stepping stones, signs side-on, a roof far off) stay sharp instead of smearing into their small mip levels */
  if (!o.repeat) applyAnisotropy();
  const ne = {
    t,
    n: e && e.n && e.n !== gpuState.flatN ? e.n : gpuState.flatN,
    w,
    h,
    v,
    im,
    nDone: false,
    u: gpuState.fr || 0,
    src,
    sw: w,
    sh: h,
  };
  gpuState.tex.set(im, ne);
  trackTexture(im, ne);
  if (typeof debugLog !== 'undefined') debugLog.mark('uploading pictures', tU, performance.now());
  if (!o.noNormal && !im.noNormal) gpuState.normQ.push(ne);
  return ne;
}
function applyAnisotropy() {
  const gl = gpuState.gl,
    n =
      gpuState.aniso && typeof engineSetting === 'function'
        ? Math.min(
            gpuState.anisoMax || 1,
            engineSetting('quality', 'sharpTex') === false
              ? 1
              : typeof walkRenderer !== 'undefined' && walkRenderer.q >= 3
                ? 2
                : 8
          )
        : 1;
  if (gpuState.aniso && n > 1) gl.texParameterf(gl.TEXTURE_2D, gpuState.aniso.TEXTURE_MAX_ANISOTROPY_EXT, n);
}
/* materials: how a picture's normal map is shaped (pillow: rounded from the outline; detail: bumps from the pixels'
   brightness) and how it takes light (spec: shine, shin: how tight the shine is, transl: light through it from
   behind, wrap: how far light wraps around it) */
export const SURFACE_MATERIALS = {
  plain: { name: 'Plain', pillow: 1, detail: 0.6, spec: 0.06, shin: 12, transl: 0, wrap: 0.15 },
  foliage: { name: 'Leaves and plants', pillow: 1.25, detail: 1.1, spec: 0.04, shin: 8, transl: 0.7, wrap: 0.45 },
  wood: { name: 'Wood', pillow: 0.6, detail: 1.2, spec: 0.08, shin: 14, transl: 0, wrap: 0.15 },
  stone: { name: 'Stone', pillow: 0.9, detail: 1.6, spec: 0.14, shin: 20, transl: 0, wrap: 0.3 },
  metal: { name: 'Metal', pillow: 0.7, detail: 0.8, spec: 0.75, shin: 48, transl: 0, wrap: 0 },
  building: { name: 'Building', pillow: 0.25, detail: 0.9, spec: 0.22, shin: 36, transl: 0, wrap: 0.1 },
  cloth: { name: 'Cloth', pillow: 0.8, detail: 0.7, spec: 0.03, shin: 6, transl: 0.25, wrap: 0.35 },
  crystal: { name: 'Crystal and glass', pillow: 0.9, detail: 0.6, spec: 1, shin: 64, transl: 0.4, wrap: 0.1 },
};
/* v32: normal maps are worked out on a helper thread (a big picture took seconds and froze the game when a scene
   opened); only reading the pixels and uploading the result happen here. Without workers it falls back to here. */
export const normalMapWorkerState = { w: null, bad: false, id: 0, jobs: new Map(), fly: 0 };
const NORMAL_MAP_WORKER_SOURCE = `const clamp=(v,a,b)=>v<a?a:v>b?b:v;onmessage=ev=>{const {id,w,h,pillow,detail,bm}=ev.data;let d=ev.data.d;
/* v33: the picture can come as a bitmap and be read here, so the main thread never waits for its pixels */
if(!d&&bm){if(typeof OffscreenCanvas==='undefined'){postMessage({id,retry:1});return}try{const oc=new OffscreenCanvas(w,h),ox=oc.getContext('2d');ox.drawImage(bm,0,0);d=ox.getImageData(0,0,w,h).data;bm.close&&bm.close()}catch(e){postMessage({id,retry:1});return}}const A=new Float32Array(w*h),Lm=new Float32Array(w*h);for(let i=0;i<w*h;i++){A[i]=d[i*4+3]>127?1:0;Lm[i]=(d[i*4]*.3+d[i*4+1]*.59+d[i*4+2]*.11)/255}
const blur=(src,r)=>{const t=new Float32Array(w*h),o=new Float32Array(w*h);for(let y=0;y<h;y++){let s=0;for(let k=-r;k<=r;k++)s+=src[y*w+clamp(k,0,w-1)];for(let X=0;X<w;X++){t[y*w+X]=s/(2*r+1);s+=src[y*w+clamp(X+r+1,0,w-1)]-src[y*w+clamp(X-r,0,w-1)]}}
for(let X=0;X<w;X++){let s=0;for(let k=-r;k<=r;k++)s+=t[clamp(k,0,h-1)*w+X];for(let y=0;y<h;y++){o[y*w+X]=s/(2*r+1);s+=t[clamp(y+r+1,0,h-1)*w+X]-t[clamp(y-r,0,h-1)*w+X]}}return o};
const r=Math.max(2,Math.round(Math.min(w,h)/14)),B=blur(blur(A,r),r),out=new Uint8Array(w*h*4);
for(let y=0;y<h;y++)for(let X=0;X<w;X++){const i=y*w+X,gx=(B[y*w+Math.min(w-1,X+1)]-B[y*w+Math.max(0,X-1)])*.5,gy=(B[Math.min(h-1,y+1)*w+X]-B[Math.max(0,y-1)*w+X])*.5;let lx=0,ly=0;
if(A[i]&&detail){const L=(X2,Y2)=>{X2=clamp(X2,0,w-1);Y2=clamp(Y2,0,h-1);const k=Y2*w+X2;return A[k]?Lm[k]:Lm[i]};lx=(L(X+1,y)-L(X-1,y))*.5;ly=(L(X,y+1)-L(X,y-1))*.5}
const nx=-gx*r*1.6*pillow-lx*detail*1.6,ny=(-gy*r*1.6+.18)*pillow-ly*detail*1.6,l=Math.hypot(nx,ny,1);out[i*4]=(nx/l*.5+.5)*255;out[i*4+1]=(ny/l*.5+.5)*255;out[i*4+2]=(1/l*.5+.5)*255;out[i*4+3]=255}
/* v32: colours bled into the see-through pixels round the outline, so far-off (smaller) copies of the picture keep their colour at the edges instead of a dark fringe */
const col=new Uint8ClampedArray(d),ok=new Uint8Array(w*h);let ar=0,ag=0,ab=0,an=0;for(let i=0;i<w*h;i++)if(d[i*4+3]>0){ok[i]=1;ar+=d[i*4];ag+=d[i*4+1];ab+=d[i*4+2];an++}
for(let pass=0;pass<4;pass++){const nk=ok.slice();for(let y=0;y<h;y++)for(let X=0;X<w;X++){const i=y*w+X;if(ok[i])continue;let r2=0,g2=0,b2=0,k=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=X+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;const j=yy*w+xx;if(ok[j]){r2+=col[j*4];g2+=col[j*4+1];b2+=col[j*4+2];k++}}
 if(k){col[i*4]=r2/k;col[i*4+1]=g2/k;col[i*4+2]=b2/k;nk[i]=1}}ok.set(nk)}
if(an)for(let i=0;i<w*h;i++)if(!ok[i]){col[i*4]=ar/an;col[i*4+1]=ag/an;col[i*4+2]=ab/an}
postMessage({id,out,col},[out.buffer,col.buffer])}`;
function ensureNormalMapWorker() {
  if (normalMapWorkerState.w || normalMapWorkerState.bad) return normalMapWorkerState.w;
  try {
    const u = URL.createObjectURL(new Blob([NORMAL_MAP_WORKER_SOURCE], { type: 'text/javascript' }));
    const W = new Worker(u);
    W.onmessage = ev => {
      const { id, out, col } = ev.data,
        j = normalMapWorkerState.jobs.get(id);
      normalMapWorkerState.jobs.delete(id);
      normalMapWorkerState.fly = Math.max(0, normalMapWorkerState.fly - 1);
      if (!j || j.gl !== gpuState.gl || gpuState.lost) return;
      const e = j.e,
        gl = gpuState.gl;
      if (e.im && gpuState.tex.get(e.im) !== e) return;
      if (ev.data.retry) {
        normalMapWorkerState.osc = false;
        gpuState.normQ.unshift(e);
        return;
      }
      /* no OffscreenCanvas in workers here: read the pixels on this side instead */ const tU = performance.now();
      try {
        const t = e.n && e.n !== gpuState.flatN ? e.n : gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, j.w, j.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, out);
        setTextureParams({ linear: true });
        e.n = t;
        if (col && e.t && engineSetting('quality', 'edgeBleed') !== false) {
          gl.bindTexture(gl.TEXTURE_2D, e.t);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, j.w, j.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(col.buffer));
          gl.generateMipmap(gl.TEXTURE_2D);
          e.bled = 1;
        }
      } catch (err) {}
      e.nDone = true;
      if (typeof debugLog !== 'undefined') debugLog.mark('uploading bump maps', tU, performance.now());
    };
    W.onerror = () => {
      normalMapWorkerState.bad = true;
      normalMapWorkerState.w = null;
      for (const j of normalMapWorkerState.jobs.values()) gpuState.normQ.unshift(j.e);
      normalMapWorkerState.jobs.clear();
      normalMapWorkerState.fly = 0;
    };
    normalMapWorkerState.w = W;
  } catch (e) {
    normalMapWorkerState.bad = true;
  }
  return normalMapWorkerState.w;
}
export function runNormalMapJobs(budget) {
  const t0 = performance.now(),
    W = ensureNormalMapWorker();
  while (gpuState.normQ.length && performance.now() - t0 < budget && (!W || normalMapWorkerState.fly < 10)) {
    const e = gpuState.normQ.shift();
    if (!e || e.nDone || (e.im && gpuState.tex.get(e.im) !== e)) continue;
    if (e.src && e.src !== e.im) e.src.__mat = e.im.__mat;
    try {
      if (
        W &&
        normalMapWorkerState.osc !== false &&
        typeof createImageBitmap === 'function' &&
        !(e.im instanceof HTMLCanvasElement && e.im.__v !== undefined)
      ) {
        const im = e.src || e.im,
          w = e.sw || e.w,
          h = e.sh || e.h,
          M = SURFACE_MATERIALS[e.im.__mat] || SURFACE_MATERIALS.plain,
          id = ++normalMapWorkerState.id,
          gl0 = gpuState.gl;
        normalMapWorkerState.jobs.set(id, { e, w, h, gl: gl0 });
        normalMapWorkerState.fly++;
        createImageBitmap(im)
          .then(bm => {
            if (gpuState.gl !== gl0 || !normalMapWorkerState.jobs.has(id)) {
              bm.close && bm.close();
              if (normalMapWorkerState.jobs.delete(id))
                normalMapWorkerState.fly = Math.max(0, normalMapWorkerState.fly - 1);
              return;
            }
            W.postMessage({ id, w, h, bm, pillow: M.pillow, detail: M.detail }, [bm]);
          })
          .catch(() => {
            normalMapWorkerState.jobs.delete(id);
            normalMapWorkerState.fly = Math.max(0, normalMapWorkerState.fly - 1);
            normalMapWorkerState.osc = false;
            gpuState.normQ.unshift(e);
          });
      } else if (W) {
        const im = e.src || e.im,
          w = e.sw || e.w,
          h = e.sh || e.h,
          c = makeCanvas(w, h),
          x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(im, 0, 0, w, h);
        const d = x.getImageData(0, 0, w, h).data,
          M = SURFACE_MATERIALS[e.im.__mat] || SURFACE_MATERIALS.plain,
          id = ++normalMapWorkerState.id;
        normalMapWorkerState.jobs.set(id, { e, w, h, gl: gpuState.gl });
        normalMapWorkerState.fly++;
        W.postMessage({ id, w, h, d, pillow: M.pillow, detail: M.detail }, [d.buffer]);
      } else {
        e.n = makeNormalMap(e.src || e.im, e.sw || e.w, e.sh || e.h, e.n);
        e.nDone = true;
      }
    } catch (err) {
      e.nDone = true;
    }
  }
}
export function makeNormalMap(im, w, h, old) {
  const M = SURFACE_MATERIALS[im.__mat] || SURFACE_MATERIALS.plain,
    c = makeCanvas(w, h),
    x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, w, h).data,
    A = new Float32Array(w * h),
    Lm = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    A[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    Lm[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  }
  const blur = (src, r) => {
    const t = new Float32Array(w * h),
      o = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += src[y * w + clamp(k, 0, w - 1)];
      for (let X = 0; X < w; X++) {
        t[y * w + X] = s / (2 * r + 1);
        s += src[y * w + clamp(X + r + 1, 0, w - 1)] - src[y * w + clamp(X - r, 0, w - 1)];
      }
    }
    for (let X = 0; X < w; X++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += t[clamp(k, 0, h - 1) * w + X];
      for (let y = 0; y < h; y++) {
        o[y * w + X] = s / (2 * r + 1);
        s += t[clamp(y + r + 1, 0, h - 1) * w + X] - t[clamp(y - r, 0, h - 1) * w + X];
      }
    }
    return o;
  };
  const r = Math.max(2, Math.round(Math.min(w, h) / 14)),
    B = blur(blur(A, r), r),
    out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let X = 0; X < w; X++) {
      const i = y * w + X,
        gx = (B[y * w + Math.min(w - 1, X + 1)] - B[y * w + Math.max(0, X - 1)]) * 0.5,
        gy = (B[Math.min(h - 1, y + 1) * w + X] - B[Math.max(0, y - 1) * w + X]) * 0.5;
      /* surface detail: brighter pixels stand a little proud of darker ones (only inside the picture) */
      let lx = 0,
        ly = 0;
      if (A[i] && M.detail) {
        const L = (X2, Y2) => {
          X2 = clamp(X2, 0, w - 1);
          Y2 = clamp(Y2, 0, h - 1);
          const k = Y2 * w + X2;
          return A[k] ? Lm[k] : Lm[i];
        };
        lx = (L(X + 1, y) - L(X - 1, y)) * 0.5;
        ly = (L(X, y + 1) - L(X, y - 1)) * 0.5;
      }
      const nx = -gx * r * 1.6 * M.pillow - lx * M.detail * 1.6,
        ny = (-gy * r * 1.6 + 0.18) * M.pillow - ly * M.detail * 1.6,
        l = Math.hypot(nx, ny, 1);
      out[i * 4] = ((nx / l) * 0.5 + 0.5) * 255;
      out[i * 4 + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      out[i * 4 + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      out[i * 4 + 3] = 255;
    }
  const gl = gpuState.gl,
    t = old && old !== gpuState.flatN ? old : gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, out);
  setTextureParams({ linear: true });
  return t;
}
/* ---------- render targets ---------- */
export function renderTarget(name, w, h, o = {}) {
  const gl = gpuState.gl,
    F = gpuState.fb[name];
  if (F && F.w === w && F.h === h) return F;
  if (F) {
    gl.deleteFramebuffer(F.f);
    if (F.c) gl.deleteTexture(F.c);
    if (F.d) gl.deleteTexture(F.d);
  }
  const f = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  let c = null,
    d = null;
  if (!o.depthOnly) {
    c = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, c);
    const hdr = o.hdr && gpuState.hdr;
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      hdr ? gl.RGBA16F : gl.RGBA8,
      w,
      h,
      0,
      gl.RGBA,
      hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
      null
    );
    setTextureParams({ linear: true });
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, c, 0);
  }
  if (o.depth || o.depthOnly) {
    d = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, d);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, d, 0);
  }
  if (o.depthOnly) {
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
  }
  return (gpuState.fb[name] = { f, c, d, w, h });
}
/* v43: a quad split into a grid (for cloth that waves); the same aC attribute as the quad */
export function bindGridQuad(nx = 16, ny = 4) {
  const gl = gpuState.gl;
  if (!gpuState.grid || gpuState.gridGL !== gl) {
    const a = [];
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const x0 = i / nx,
          x1 = (i + 1) / nx,
          y0 = j / ny,
          y1 = (j + 1) / ny;
        a.push(x0, y0, x1, y0, x0, y1, x0, y1, x1, y0, x1, y1);
      }
    gpuState.grid = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gpuState.grid);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(a), gl.STATIC_DRAW);
    gpuState.gridN = nx * ny * 6;
    gpuState.gridGL = gl;
  }
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, gpuState.grid);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  for (let i = 1; i < 4; i++) {
    gl.disableVertexAttribArray(i);
    gl.vertexAttribDivisor(i, 0);
  }
}
export function bindQuad() {
  const gl = gpuState.gl;
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, gpuState.quad);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  for (let i = 1; i < 4; i++) {
    gl.disableVertexAttribArray(i);
    gl.vertexAttribDivisor(i, 0);
  }
}
export function uploadMesh(V, I, attrs, stride) {
  const gl = gpuState.gl,
    vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, V, gl.STATIC_DRAW);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, I, gl.STATIC_DRAW);
  const locs = { aPos: 0, aNrm: 1, aShore: 1, aUV: 2, aDK: 3 };
  for (const [n, s, o] of attrs) {
    const l = locs[n];
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, s, gl.FLOAT, false, stride, o);
  }
  gl.bindVertexArray(null);
  return { vao, n: I.length, vb, ib };
}
export function freeMesh(m) {
  if (!m) return;
  const gl = gpuState.gl;
  try {
    gl.deleteVertexArray(m.vao);
    gl.deleteBuffer(m.vb);
    if (m.ib) gl.deleteBuffer(m.ib);
  } catch (e) {}
}

/* v34: how long the graphics card itself takes for a frame (EXT_disjoint_timer_query_webgl2, where the browser has
   it). A few queries are in flight at once; each answer arrives a frame or two later and goes into gpuState.gpuMs (a
   running average) and the log's slow-frame causes. Off with the "Measure the graphics card" dial. */
export function beginGpuTimer() {
  const gl = gpuState.gl;
  if (!gl || !(engineSetting('quality', 'gpuTimer') ?? true)) return null;
  if (gpuState.gpuX === undefined) {
    try {
      gpuState.gpuX = gl.getExtension('EXT_disjoint_timer_query_webgl2') || null;
    } catch (e) {
      gpuState.gpuX = null;
    }
    gpuState.gpuQ = [];
  }
  const X = gpuState.gpuX;
  if (!X) return null;
  pollGpuTimers();
  if (gpuState.gpuQ.length >= 4 || gpuState.gpuOpen) return null;
  const q = gl.createQuery();
  gl.beginQuery(X.TIME_ELAPSED_EXT, q);
  gpuState.gpuOpen = true;
  return q;
}
export function endGpuTimer(q) {
  if (!q) return;
  const gl = gpuState.gl,
    X = gpuState.gpuX;
  try {
    gl.endQuery(X.TIME_ELAPSED_EXT);
  } catch (e) {}
  gpuState.gpuOpen = false;
  gpuState.gpuQ.push(q);
}
function pollGpuTimers() {
  const gl = gpuState.gl,
    X = gpuState.gpuX,
    Q = gpuState.gpuQ;
  if (!X || !Q.length) return;
  const dis = gl.getParameter(X.GPU_DISJOINT_EXT);
  while (Q.length) {
    const q = Q[0];
    if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
    Q.shift();
    const ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
    gl.deleteQuery(q);
    if (dis) continue;
    const ms = ns / 1e6;
    gpuState.gpuLast = ms;
    gpuState.gpuMs = gpuState.gpuMs ? gpuState.gpuMs * 0.9 + ms * 0.1 : ms;
    gpuState.gpuMax = Math.max((gpuState.gpuMax || 0) * 0.995, ms);
  }
}

/* v34: a cap on pictures kept on the graphics card. Every uploaded picture is counted (with its mip levels and normal
   map); past the cap (128 MB on phones since v41, 384 MB elsewhere) the ones not drawn for the longest go first (never those used
   in the last ten seconds) and are uploaded again if they come back into view. */
function trackTexture(im, e) {
  const L = gpuState.texL || (gpuState.texL = new Map());
  e.bytes = Math.round((e.sw || e.w || 1) * (e.sh || e.h || 1) * 4 * 1.34 * 2);
  if (!L.has(im)) gpuState.texB = (gpuState.texB || 0) + e.bytes;
  L.set(im, e);
}
export function trimTextures(force) {
  const L = gpuState.texL;
  if (!L) return 0;
  const phone = /Android|iPhone|iPad/.test(navigator.userAgent),
    cap = (force || (phone ? 128 : 384)) * 1048576;
  if ((gpuState.texB || 0) <= cap) return 0;
  const gl = gpuState.gl,
    now = gpuState.fr || 0,
    old = [...L.entries()].filter(([im, e]) => now - (e.u || 0) > 600).sort((a, b) => (a[1].u || 0) - (b[1].u || 0));
  let n = 0;
  for (const [im, e] of old) {
    if (gpuState.texB <= cap * 0.85) break;
    try {
      if (gpuState.tex.get(im) === e) {
        gl.deleteTexture(e.t);
        if (e.n && e.n !== gpuState.flatN) gl.deleteTexture(e.n);
        gpuState.tex.delete(im);
      }
    } catch (err) {}
    L.delete(im);
    gpuState.texB -= e.bytes;
    n++;
  }
  gpuState.texTrimmed = (gpuState.texTrimmed || 0) + n;
  return n;
}
