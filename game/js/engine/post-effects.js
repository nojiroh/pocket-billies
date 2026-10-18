'use strict';
/* ================= ENGINE POST =================
   After a view draws its world into an HDR target: depth of field from real distance (round highlights for bright
   spots), bloom from bright pixels (this is what makes lamps and windows glow; there are no halo discs), then exposure,
   a soft highlight roll-off instead of clipping, contrast, saturation, warmth, vignette, chromatic aberration, grain
   and a light sharpen. Also takes a small screenshot for the debug log when asked. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { RM, provide } from '../hooks.js';
import { clamp } from '../util.js';
import { makeCanvas } from '../art.js';
import { walkView } from '../walk-view.js';
import { engineColor, engineSetting } from './settings.js';
import { EGL, EGL_GLSL_LIGHT, eglBindQuad, eglPrograms, eglTarget } from './webgl.js';
import { setLightUniforms } from './light.js';
/* eslint-disable no-func-assign */
expose({
  COLOR_GRADES: [() => COLOR_GRADES],
  POST_EFFECT_SHADERS: [() => POST_EFFECT_SHADERS],
  colorGrade: [() => colorGrade, v => (colorGrade = v)],
  drawPostEffects: [() => drawPostEffects, v => setDrawPostEffects(v)],
  projectToScreenUv: [() => projectToScreenUv, v => (projectToScreenUv = v)],
  screenSnapshot: [() => screenSnapshot, v => (screenSnapshot = v)],
  sunScreenPosition: [() => sunScreenPosition, v => (sunScreenPosition = v)],
});
/* eslint-enable no-func-assign */
export function setDrawPostEffects(v) {
  drawPostEffects = v; // eslint-disable-line no-func-assign
  provide({ drawPostEffects });
}
/* to-module: end */
export const POST_EFFECT_SHADERS = {
  dof: [
    `#version 300 es
precision highp float;in vec2 aC;out vec2 vUV;void main(){vUV=aC;gl_Position=vec4(aC*2.-1.,0.,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;out vec4 o;uniform sampler2D uCol,uDep;uniform vec2 uPx;uniform float uN,uF,uFocus,uBand,uRampF,uRampN,uMaxR,uBokeh;uniform int uTaps;
float lin(float d){float z=d*2.-1.;return 2.*uN*uF/(uF+uN-z*(uF-uN));}
float coc(float z){float dz=z-uFocus;return dz>0.?smoothstep(uBand,uBand+uRampF,dz):smoothstep(uBand*.6,uBand*.6+uRampN,-dz);}
void main(){float zc=lin(texture(uDep,vUV).r),cc=coc(zc);vec3 acc=texture(uCol,vUV).rgb;float ws=1.;
 if(cc>.02){float nt=float(uTaps);for(int i=0;i<28;i++){if(i>=uTaps)break;float a=float(i)*2.39996,r=sqrt((float(i)+.5)/nt);vec2 q=vUV+vec2(cos(a),sin(a))*r*uMaxR*cc*uPx;
  float zs=lin(texture(uDep,q).r),cs=coc(zs);float w=zs<zc?max(cs,cc*.35):cc;vec3 s=texture(uCol,q).rgb;float l=dot(s,vec3(.3,.59,.11));w*=1.+smoothstep(.8,1.6,l)*2.5*uBokeh;acc+=s*w;ws+=w;}}
 o=vec4(acc/ws,cc);}`,
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
precision highp float;in vec2 vUV;out vec4 o;uniform sampler2D uDep;uniform vec2 uPx;uniform float uN,uF,uR,uFoc,uRange;
float lin(float d){float z=d*2.-1.;return 2.*uN*uF/(uF+uN-z*(uF-uN));}
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
uniform float uKind;
/* v43: horizon-based occlusion. Along four directions (rotated per pixel) the pixel walks outward and keeps the steepest
   rise above its own depth: the higher the horizon all round, the less of the sky it sees. Falls off with distance so
   only nearby things count, and fades out far from the camera where a pixel is many metres. */
float horizonAO(float z,float r,float a0){float occ=0.;float mpp=z/uFoc;/* metres per screen pixel at this depth */
 for(int d=0;d<4;d++){float a=a0+float(d)*1.5708;vec2 dir=vec2(cos(a),sin(a))*uPx;float hz=-1.;
  for(int i=1;i<=5;i++){float k=(float(i)-.3)/5.;vec2 q=vUV+dir*r*k*k*5.;float zs=lin(texture(uDep,q).r);float dz=z-zs-.03;float dist=max(.05,r*k*k*5.*mpp);float sl=dz/dist;float w=1.-smoothstep(uRange*.6,uRange*2.,dz);hz=max(hz,sl*w*step(0.,dz));}
  occ+=clamp(hz,0.,1.)*clamp(hz*1.4,0.,1.);}
 return occ/4.;}
void main(){float d0=texture(uDep,vUV).r;if(d0>.9999){o=vec4(0.);return;}float z=lin(d0),r=clamp(uR*uFoc/z,2.,40.),a0=h(gl_FragCoord.xy)*6.28,occ=0.,bias=.04+z*.015;
 if(uKind>.5){o=vec4(horizonAO(z,r,a0)*(1.-smoothstep(18.,36.,z)),0.,0.,1.);return;}
 for(int i=0;i<10;i++){float a=a0+float(i)*2.39996,k=sqrt((float(i)+.5)/10.);vec2 q=vUV+vec2(cos(a),sin(a))*k*r*uPx;float zs=lin(texture(uDep,q).r),dz=z-zs;
  occ+=step(bias,dz)*(1.-smoothstep(uRange*.4,uRange,dz));}
 o=vec4(occ/10.*(1.-smoothstep(18.,36.,z)),0.,0.,1.);}`,
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
precision highp float;in vec2 vUV;out vec4 o;uniform sampler2D uDep;uniform mat4 uIVP;uniform float uN,uF,uK,uLK,uDens,uMaxD;${EGL_GLSL_LIGHT}
/* v43: light in the air. From the camera to what each pixel shows, the ray is walked in twelve steps; at each the sun's
   shadow map says whether the air there is lit (the near map first, the far cascade beyond it), and the nearest lamps
   add their glow. Forward scattering (Henyey-Greenstein) makes rays toward the sun bright; the air is thickest low down. */
float lin(float d){float z=d*2.-1.;return 2.*uN*uF/(uF+uN-z*(uF-uN));}
float vis(vec3 p){if(uShadowOn<.5)return 1.;vec4 q=uShadowM*vec4(p,1.);vec3 c=q.xyz/q.w*.5+.5;if(c.x>.01&&c.y>.01&&c.x<.99&&c.y<.99&&c.z<=1.)return texture(uShadow,vec3(c.xy,c.z-.002));
 if(uShadow2On<.5)return 1.;vec4 q2=uShadowM2*vec4(p,1.);vec3 c2=q2.xyz/q2.w*.5+.5;if(c2.x<0.||c2.y<0.||c2.x>1.||c2.y>1.||c2.z>1.)return 1.;return texture(uShadow2,vec3(c2.xy,c2.z-.003));}
void main(){float d0=texture(uDep,vUV).r;vec4 wp=uIVP*vec4(vUV*2.-1.,min(d0,.9999)*2.-1.,1.);vec3 P=wp.xyz/wp.w;vec3 ray=P-uEye;float L=length(ray);vec3 dir=ray/max(L,.001);L=min(L,uMaxD);
 float j=lhash(gl_FragCoord.xy*.37);float cs=dot(dir,uSunDir);const float g=.45;float ph=(1.-g*g)/pow(1.+g*g-2.*g*cs,1.5);
 vec3 sun=vec3(0.),lamps=vec3(0.);
 /* alpha 0.4.1: seen from above, the air that matters is the last stretch above the ground, where trees, roofs and
    awnings stand in the light. The march covers only that stretch, the air is thickest near the ground, and the phase
    has a broad part as well as the forward peak, so beams through leaves and between houses read from the game's camera */
 float t0=max(0.,L-14.),dt=(L-t0)/14.;
 for(int i=0;i<14;i++){float t=t0+(float(i)+j)*dt;vec3 p=uEye+dir*t;float dens=exp(-max(0.,p.y-P.y)*.32)*.85+exp(-max(0.,p.y-uMistY)*.1)*.15;float dd=dens*dt*.045;sun+=vec3(vis(p)*dd,dd,0.);
  for(int l=0;l<6;l++){if(l>=uNL)break;vec4 Lp=uLP[l];vec3 d=Lp.xyz-p;float r=abs(Lp.w),ll=length(d);float f=max(0.,1.-ll/(r*1.3));lamps+=uLC[l].rgb*f*f/(1.+ll*ll*.35)*dt;}}
 /* lit air brightens a little; air in the shadow of a canopy or a roof darkens what is behind it (alpha), so the beams
    show as light and dark columns, on any graphics chip (no negative light needed) */
 float pk=(ph*.6+.55)*uDens*step(d0,.9999)*(1.-smoothstep(26.,46.,length(ray)));/* not in the sky, and fading out with distance: the beams are a near thing */o=vec4(uSunCol*min(sun.x*pk*.4,1.2)*uK+lamps*uLK*.18,clamp((sun.y-sun.x)*pk*1.1*uK,0.,.6));}`,
  ],
  grade: [
    `#version 300 es
precision highp float;in vec2 aC;out vec2 vUV;void main(){vUV=aC;gl_Position=vec4(aC*2.-1.,0.,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;out vec4 o;uniform sampler2D uCol,uDof,uBloom,uAO,uRays,uDep,uVol;uniform vec2 uPx;uniform vec4 uHeatS[6];uniform float uHeatN;uniform float uVolK,uExp,uShoulder,uCon,uSat,uWarm,uVig,uCA,uGrain,uSharp,uBloomK,uTime,uDofOn,uAOK,uRaysK,uTone,uHeat,uInk,uNear,uFar,uGlare;uniform vec3 uLift,uGam,uGain,uShT,uHiT,uRayC,uSunP;
float linz(float d){float z=d*2.-1.;return 2.*uNear*uFar/(uFar+uNear-z*(uFar-uNear));}
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
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
 vec4 b=texture(uDof,vUV);vec3 c=uDofOn>.5?mix(s,b.rgb,smoothstep(.02,.4,b.a)):s;
 if(uAOK>0.){vec2 e=uPx*1.5;float ao=texture(uAO,vUV).r*.4+(texture(uAO,vUV+vec2(e.x,e.y)).r+texture(uAO,vUV-vec2(e.x,e.y)).r+texture(uAO,vUV+vec2(e.x,-e.y)).r+texture(uAO,vUV+vec2(-e.x,e.y)).r)*.15;c*=1.-clamp(ao*uAOK,0.,.75);}
 /* v33: ink outlines where depth jumps (silhouettes of props, people and billionaires), thinner with distance */
 if(uInk>0.){float d0=texture(uDep,vUV).r;if(d0<.9999){float z0=linz(d0),e=0.;vec2 q=uPx*1.;float zs[4];zs[0]=linz(texture(uDep,vUV+vec2(q.x,0)).r);zs[1]=linz(texture(uDep,vUV-vec2(q.x,0)).r);zs[2]=linz(texture(uDep,vUV+vec2(0,q.y)).r);zs[3]=linz(texture(uDep,vUV-vec2(0,q.y)).r);
  for(int i=0;i<4;i++)e=max(e,(zs[i]-z0)/z0);/* v47: one outline rule: a darker shade of the thing's own colour on props, buildings and characters; the ground (alpha 0) gets none */c*=1.-uInk*step(.5,texture(uCol,vUV).a)*smoothstep(.06,.22,e)*.62*(1.-smoothstep(25.,60.,z0));}}
 c+=texture(uBloom,vUV).rgb*uBloomK;if(uRaysK>0.)c+=texture(uRays,vUV).rgb*uRayC*uRaysK*.4;if(uVolK>0.){vec4 va=texture(uVol,vUV);c=c*(1.-va.a*uVolK)+va.rgb*uVolK;}
 /* v33: sun glare: a soft halo round the sun and a few ghosts along the line through the middle, only when the sun is in the open */
 if(uGlare>0.&&uSunP.z>0.){float vis=texture(uDep,clamp(uSunP.xy,.002,.998)).r>.9999?1.:0.;if(vis>0.){vec2 a=vec2(uPx.y/uPx.x,1.);vec2 sp=uSunP.xy,dv=(vUV-sp)*a;float r=length(dv);
  vec3 g=uRayC*(exp(-r*7.)*.55+exp(-r*26.)*.6)*uSunP.z;vec2 ax=(vec2(.5)-sp);for(int i=1;i<=4;i++){float f=float(i)*.42;vec2 gp=sp+ax*f*2.;float rr=length((vUV-gp)*a),sz=.025+.02*float(i);g+=uRayC*vec3(.6+.1*float(i),.75,1.)*smoothstep(sz,sz*.6,rr)*.07*uSunP.z;}
  c+=g*uGlare*vis;}}
 else if(uGlare>0.&&uSunP.z<0.){vec2 a=vec2(uPx.y/uPx.x,1.);vec2 e=clamp(uSunP.xy,-.05,1.05);float r=length((vUV-e)*a);c+=uRayC*(exp(-r*2.6)*.16+exp(-r*7.)*.1)*-uSunP.z*uGlare;}
 c=uTone>.5?mix(roll(c*uExp),film(c*uExp*1.25),uTone>1.5?1.:.85):roll(c*uExp);if(uTone>1.5)c=(c-.5)*1.08+.5;c.r*=1.+uWarm*.08;c.b*=1.-uWarm*.1;float l=dot(c,vec3(.3,.59,.11));c=mix(vec3(l),c,uSat);c=(c-.5)*uCon+.5;
 c=pow(max(c*uGain+uLift*(1.-c),0.),1./uGam);float lg=clamp(dot(c,vec3(.3,.59,.11)),0.,1.);c+=uShT*(1.-lg)*(1.-lg)+uHiT*lg*lg;
 c*=1.-uVig*pow(length(d*vec2(1.,.85))*1.25,2.6);c+=(h(vUV*1000.+uTime*.001)-.5)*uGrain;/* v34: a fixed half-step dither against banding in sky gradients, fog and dusk light */{vec2 q=floor(gl_FragCoord.xy);float bd=fract(52.9829189*fract(dot(q,vec2(.06711056,.00583715))));c+=(bd-.5)/255.;}o=vec4(c,1.);}`,
  ],
};
/* draws the post chain from scene target S (color + depth) to the screen */
export function drawPostEffects(S, C, focusDist, rw, rh, o = {}) {
  const gl = EGL.gl;
  eglPrograms(POST_EFFECT_SHADERS);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  eglBindQuad();
  const hw = Math.max(16, rw >> 1),
    hh = Math.max(16, rh >> 1),
    use = (name, F, w, h) => {
      const p = EGL.P[name];
      gl.bindFramebuffer(gl.FRAMEBUFFER, F ? F.f : null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(p.p);
      return p.U;
    },
    tex = (U, name, unit, t) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.uniform1i(U[name], unit);
    };
  /* depth of field */
  const blur = (o.blur ?? 1) * engineSetting('lens', 'blur'),
    dofOn = blur > 0.01 && !o.noDof,
    D = eglTarget('dof', hw, hh, { hdr: true });
  if (dofOn) {
    const U = use('dof', D, hw, hh);
    tex(U, 'uCol', 0, S.c);
    tex(U, 'uDep', 1, S.d);
    gl.uniform2f(U.uPx, 1 / hw, 1 / hh);
    gl.uniform1f(U.uN, C.near);
    gl.uniform1f(U.uF, C.far);
    gl.uniform1f(U.uFocus, focusDist);
    gl.uniform1f(U.uBand, C.df * engineSetting('lens', 'focusBand'));
    gl.uniform1f(U.uRampF, C.df * engineSetting('lens', 'blurFar'));
    gl.uniform1f(U.uRampN, C.df * engineSetting('lens', 'blurNear'));
    gl.uniform1f(U.uMaxR, Math.max(3, hh / 70) * blur);
    gl.uniform1f(U.uBokeh, engineSetting('lens', 'bokeh'));
    gl.uniform1i(U.uTaps, o.fast ? 14 : 28);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  /* bloom: bright pass at half size, down to 1/16, back up */
  const bk = engineSetting('color', 'bloom') * (o.bloom ?? 1),
    chain = [];
  let src = S.c,
    w = hw,
    h = hh;
  if (bk > 0.01) {
    let U = use('bright', eglTarget('b0', w, h, { hdr: true }), w, h);
    tex(U, 'uCol', 0, S.c);
    gl.uniform2f(U.uPx, 1 / rw, 1 / rh);
    gl.uniform1f(U.uT, engineSetting('color', 'bloomThreshold'));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    chain.push(EGL.fb.b0);
    for (let i = 1; i < (o.bloomN || 5); i++) {
      const pw = w,
        ph = h;
      w = Math.max(4, w >> 1);
      h = Math.max(4, h >> 1);
      const F = eglTarget('b' + i, w, h, { hdr: true });
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
    AO = eglTarget('ao', hw, hh);
    const U = use('ao', AO, hw, hh);
    tex(U, 'uDep', 0, S.d);
    gl.uniform2f(U.uPx, 1 / hw, 1 / hh);
    gl.uniform1f(U.uN, C.near);
    gl.uniform1f(U.uF, C.far);
    gl.uniform1f(U.uR, engineSetting('shadows', 'aoRadius'));
    gl.uniform1f(U.uFoc, (C.F || hh) * 0.5);
    gl.uniform1f(U.uRange, Math.max(0.3, engineSetting('shadows', 'aoRadius') * 1.6));
    gl.uniform1f(U.uKind, (engineSetting('shadows', 'aoKind') || 'horizon') === 'horizon' ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  /* light shafts: the sky and the brightest spots smeared toward the sun's place on screen */
  const rk = o.sun && !o.noRays ? engineSetting('sun', 'shafts') * (o.sun[2] ?? 1) : 0;
  let RY = null;
  if (rk > 0.01) {
    const qw = Math.max(16, hw >> 1),
      qh = Math.max(16, hh >> 1);
    RY = eglTarget('rays', qw, qh, { hdr: true });
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
  let VO = null;
  if (X && (gk > 0.01 || lk > 0.01) && X.shadow) {
    const qw = Math.max(16, hw >> 1),
      qh = Math.max(16, hh >> 1),
      V0 = eglTarget('vol0', qw, qh, { hdr: true });
    const U = use('vol', V0, qw, qh);
    const p = EGL.P.vol;
    setLightUniforms(p, X);
    tex(U, 'uDep', 0, S.d);
    gl.uniformMatrix4fv(U.uIVP, false, o.ivp);
    gl.uniform1f(U.uN, C.near);
    gl.uniform1f(U.uF, C.far);
    gl.uniform1f(U.uK, gk);
    gl.uniform1f(U.uLK, lk);
    gl.uniform1f(U.uDens, o.volDens ?? 1);
    gl.uniform1f(U.uMaxD, o.volMax || 48);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    VO = eglTarget('vol1', qw, qh, { hdr: true });
    const U2 = use('down', VO, qw, qh);
    tex(U2, 'uCol', 0, V0.c);
    gl.uniform2f(U2.uPx, 1 / qw, 1 / qh);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  /* grade to the screen */
  const U = use('grade', null, rw, rh);
  tex(U, 'uCol', 0, S.c);
  tex(U, 'uDof', 1, D.c);
  tex(U, 'uBloom', 2, bk > 0.01 ? chain[0].c : EGL.white);
  gl.uniform2f(U.uPx, 1 / rw, 1 / rh);
  gl.uniform1f(U.uDofOn, dofOn ? 1 : 0);
  gl.uniform1f(U.uBloomK, bk > 0.01 ? bk * 0.6 : 0);
  gl.uniform1f(U.uExp, engineSetting('color', 'exposure'));
  if (U.uTone) {
    const tm = engineSetting('color', 'tone') || 'soft';
    gl.uniform1f(U.uTone, tm === 'film' ? 1 : tm === 'punchy' ? 2 : 0);
    gl.uniform1f(U.uHeat, RM ? 0 : (o.heat || 0) * (engineSetting('air', 'heat') ?? 1));
  }
  if (U.uHeatN) {
    const hs = RM ? null : o.heatS;
    gl.uniform1f(U.uHeatN, hs ? hs.length / 4 : 0);
    if (hs && hs.length) gl.uniform4fv(U.uHeatS, hs);
  }
  gl.uniform1f(U.uShoulder, engineSetting('color', 'shoulder'));
  const MO = o.mood;
  gl.uniform1f(U.uCon, engineSetting('color', 'contrast') * (MO ? MO.con : 1));
  gl.uniform1f(U.uSat, engineSetting('color', 'saturation') * (MO ? MO.sat : 1));
  gl.uniform1f(U.uWarm, engineSetting('color', 'warmth') + (MO ? MO.warm : 0));
  gl.uniform1f(U.uVig, engineSetting('lens', 'vignette'));
  gl.uniform1f(U.uCA, engineSetting('lens', 'aberration'));
  gl.uniform1f(U.uGrain, RM ? 0 : engineSetting('lens', 'grain'));
  gl.uniform1f(U.uSharp, engineSetting('lens', 'sharpen'));
  gl.uniform1f(U.uTime, typeof walkView !== 'undefined' ? walkView.t : 0);
  tex(U, 'uVol', 12, VO ? VO.c : EGL.white);
  gl.bindSampler(12, null);
  gl.uniform1f(U.uVolK, VO ? 1 : 0);
  tex(U, 'uAO', 3, AO ? AO.c : EGL.white);
  if (U.uDep) {
    tex(U, 'uDep', 5, S.d);
    gl.uniform1f(U.uNear, C.near);
    gl.uniform1f(U.uFar, C.far);
    gl.uniform1f(U.uInk, engineSetting('color', 'ink') ?? 0.35);
    const sp = o.sun;
    gl.uniform3f(U.uSunP, sp ? sp[0] : 0, sp ? sp[1] : 0, sp ? sp[2] * (sp[3] ? -1 : 1) : 0);
    gl.uniform1f(U.uGlare, !sp ? 0 : (engineSetting('sun', 'glare') ?? 0.6));
  }
  gl.uniform1f(U.uAOK, AO ? aoK : 0);
  tex(U, 'uRays', 4, RY ? RY.c : EGL.white);
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
  const gl = EGL.gl,
    k = Math.min(1, max / Math.max(rw, rh)),
    w = Math.max(1, Math.round(rw * k)),
    h = Math.max(1, Math.round(rh * k)),
    F = eglTarget('snap', w, h);
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
