'use strict';
/* ================= 3D BUILDINGS (v17) =================
   Houses, shops and towers drawn as small 3D models instead of standing pictures. A building prop with a "build" plan
   (game data; tools/build-buildings.py writes the first ones) becomes:
   - its front: the building's own picture, with the roof part cut away and the window glass made see-through
   - side and back walls with a tiled pixel texture in the building's colours, a stone foundation, windows of their own
   - a roof at its real pitch (hip, gable, front gable, flat with a parapet, or a lean-to) with an overhang, fascia
     boards, a ridge cap and a tiled roof texture; a chimney where the picture has one (the smoke comes out of it)
   - windows you can look into: behind every pane a simple room (back wall with furniture, side walls, floor and
     ceiling) drawn with "interior mapping", so it shifts with your view like a real room; lit at night
   The models cast and receive sun shadows like everything else. The Studio's prop pictures still
   use the picture, so a repainted picture changes the front of the 3D building too. Engine setting world.buildings3d
   turns the models off (the pictures stand in as before). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { artCacheVersion, provide } from './hooks.js';
import { hexToRgb, makeCanvas } from './art.js';
import { artImage, hash2d, walkData, walkView } from './walk-view.js';
import { engineContext, engineSetting } from './engine/settings.js';
import {
  COMMON_GLSL,
  LIGHT_GLSL,
  LOOK_GLSL,
  bindQuad,
  ensurePrograms,
  gpuState,
  imageTexture,
  normalize3,
} from './engine/webgl.js';
import { environment, environmentLitFraction } from './environment.js';
import { walkRenderer } from './walk/walk-state.js';
import { standingHeightAt } from './walk/heights.js';
import { useWalkProgram, worldCurveArgs } from './walk/draw-common.js';
import { setPropLookUniforms } from './walk/prop-look.js';
/* eslint-disable no-func-assign */
expose({
  BUILDING_RAMP_GLSL: [() => BUILDING_RAMP_GLSL],
  BUILDING_ROOM_NAMES: [() => BUILDING_ROOM_NAMES],
  BUILDING_SHADERS: [() => BUILDING_SHADERS],
  BUILDING_SIGNATURE_CACHE: [() => BUILDING_SIGNATURE_CACHE],
  BUILDING_TEXTURE_NAMES: [() => BUILDING_TEXTURE_NAMES],
  buildingArt: [() => buildingArt, v => (buildingArt = v)],
  buildingBudgetLeft: [() => buildingBudgetLeft, v => (buildingBudgetLeft = v)],
  buildingColor: [() => buildingColor, v => (buildingColor = v)],
  buildingFrontPicture: [
    () => buildingFrontPicture,
    v => ((buildingFrontPicture = v), provide({ buildingFrontPicture })),
  ],
  buildingGuard: [() => buildingGuard, v => ((buildingGuard = v), provide({ buildingGuard }))],
  buildingItems: [() => buildingItems, v => setBuildingItems(v)],
  buildingMesh: [() => buildingMesh, v => ((buildingMesh = v), provide({ buildingMesh }))],
  buildingRotation: [() => buildingRotation, v => (buildingRotation = v)],
  buildingSignature: [() => buildingSignature],
  buildingState: [() => buildingState],
  buildingTextureCell: [() => buildingTextureCell],
  buildingTextureGrid: [() => buildingTextureGrid, v => (buildingTextureGrid = v)],
  buildingsOn: [() => buildingsOn],
  cachedBuildingSignature: [
    () => cachedBuildingSignature,
    v => ((cachedBuildingSignature = v), provide({ cachedBuildingSignature })),
  ],
  chimneySmoke: [() => chimneySmoke, v => ((chimneySmoke = v), provide({ chimneySmoke }))],
  drawBuildingShadows: [() => drawBuildingShadows, v => ((drawBuildingShadows = v), provide({ drawBuildingShadows }))],
  drawBuildingShadowsUnguarded: [() => drawBuildingShadowsUnguarded, v => (drawBuildingShadowsUnguarded = v)],
  drawBuildings: [() => drawBuildings, v => setDrawBuildings(v)],
  drawBuildingsUnguarded: [() => drawBuildingsUnguarded, v => (drawBuildingsUnguarded = v)],
  freeBuildingMesh: [() => freeBuildingMesh, v => (freeBuildingMesh = v)],
  frontWindowLight: [() => frontWindowLight, v => ((frontWindowLight = v), provide({ frontWindowLight }))],
  hexColorSet: [() => hexColorSet, v => (hexColorSet = v)],
  litWindowFraction: [() => litWindowFraction, v => ((litWindowFraction = v), provide({ litWindowFraction }))],
  makeBuildingModel: [() => makeBuildingModel, v => (makeBuildingModel = v)],
});
/* eslint-enable no-func-assign */
provide({
  buildingFrontPicture,
  buildingGuard,
  buildingMesh,
  cachedBuildingSignature,
  chimneySmoke,
  drawBuildingShadows,
  drawBuildings,
  frontWindowLight,
  litWindowFraction,
});
export function setBuildingItems(v) {
  buildingItems = v; // eslint-disable-line no-func-assign
  provide({ buildingItems });
}
export function setDrawBuildings(v) {
  drawBuildings = v; // eslint-disable-line no-func-assign
  provide({ drawBuildings });
}
/* to-module: end */
export const buildingState = { mesh: new WeakMap(), fac: new WeakMap(), vao: null };
provide({ buildingState }); /* to-module */
export const BUILDING_TEXTURE_NAMES = [
  'Plaster',
  'Siding',
  'Brick',
  'Stone blocks',
  'Board and batten',
  'Concrete panels',
  'Corrugated metal',
  'Tiles',
  'Clay roof tiles',
  'Shingles',
  'Slate',
  'Thatch',
  'Metal seams',
  'Flat roof',
  'Planks',
  'Plain',
  'Moss',
  'Solar shingles',
  'Balloon cloth',
  'Rivets',
  'Stripes',
  'Rings',
];
export const BUILDING_ROOM_NAMES = ['Living room', 'Kitchen', 'Bedroom', 'Shop', 'Office', 'Clinic', 'Lab', 'Stairs'];
const buildingSignature = B =>
  [
    B.kind,
    B.pitch,
    B.over,
    B.eave,
    B.apex,
    B.wall,
    B.floors,
    B.wallCol,
    B.roofCol,
    B.trimCol,
    B.wallTex,
    B.roofTex,
    B.sideWin,
    (B.win || []).join(';'),
    B.rooms,
    B.chimney && [B.chimney.x, B.chimney.top, B.chimney.w, B.chimney.lean || 0],
    B.base && [B.base.col, B.base.h],
  ].join('|');
const buildingsOn = () => !buildingState.fail && engineSetting('world', 'buildings3d') !== false;
provide({ buildingsOn }); /* to-module */
/* if this device can't build or draw the models, the pictures stand in from then on (and the debug log says why) */
export function buildingGuard(fn) {
  if (buildingState.fail) return;
  try {
    fn();
  } catch (e) {
    buildingState.fail = String((e && e.message) || e);
    console.error('3D buildings off: ' + buildingState.fail);
    if (typeof debugLog !== 'undefined') debugLog.add('webgl', '3D buildings off: ' + buildingState.fail);
    try {
      const gl = gpuState.gl;
      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.enable(gl.DEPTH_TEST);
    } catch (e2) {}
  }
}
export function buildingArt() {
  const C = walkData().sc;
  return C.buildArt || { detail: 'scene/build/detail.png', rooms: 'scene/build/rooms.png' };
}
/* alpha 0.4: the texture sheet is 8 cells across and as many rows as it has (16 textures were 2 rows; the moss and solar roofs start a third) */
export function buildingTextureGrid(A) {
  const im = artImage(A.detail),
    w = im && (im.naturalWidth || im.width),
    h = im && (im.naturalHeight || im.height);
  return [8, w && h ? Math.max(1, Math.round(h / (w / 8))) : 2];
}
const BUILDING_RAMP_GLSL = `vec3 rampC(vec3 b,float t){vec3 d0=mix(b*.55,vec3(.235,.165,.439),.30),d1=mix(b*.79,vec3(.376,.29,.596),.17),l3=mix(b,vec3(1.,.957,.769),.30),l4=mix(b,vec3(1.,.988,.918),.60);return t<.5?d0:t<1.5?d1:t<2.5?b:t<3.5?l3:l4;}
float bayer4(vec2 p){ivec2 i=ivec2(mod(p,4.));int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i.y*4+i.x])+.5)/16.;}`;
export const BUILDING_SHADERS = {
  bld: [
    `#version 300 es
precision highp float;layout(location=0) in vec3 bPosIn;layout(location=1) in vec3 bNrmIn;layout(location=2) in vec2 bUVIn;layout(location=3) in vec3 bTexIn;layout(location=4) in vec3 bColIn;
uniform mat4 uVP;uniform vec2 uLift;out vec3 vW;out vec3 vN;out vec2 vUV;out vec3 vTex;out vec3 vCol;${COMMON_GLSL}
void main(){vec3 p=bPosIn;p.y+=curveY(uLift);vW=p;vN=bNrmIn;vUV=bUVIn;vTex=bTexIn;vCol=bColIn;gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec3 vW;in vec3 vN;in vec2 vUV;in vec3 vTex;in vec3 vCol;out vec4 o;uniform sampler2D uDet;uniform float uFade,uBaseY;uniform vec2 uScroll,uAtl;${LIGHT_GLSL}${BUILDING_RAMP_GLSL}${LOOK_GLSL}uniform vec3 uBP;
void main(){if(uFade<.99&&bayer4(gl_FragCoord.xy)>uFade)discard;
 vec2 g=(vUV+uScroll)*.5,f=vec2(fract(g.x),1.-fract(g.y)),a=(vTex.xy+f)/uAtl;float lv=textureGrad(uDet,a,dFdx(g)/uAtl,dFdy(g)/uAtl).r*4.;
 vec3 c=vTex.z>.5?vCol:rampC(vCol,floor(lv+.5));c=lookOn(c,floor(vUV*16.),clamp((vW.y-uBaseY)/4.,0.,1.),uBP);vec3 n=normalize(vN);if(uSeason.w>0.)c=mix(c,vec3(.9,.93,.98),min(1.,uSeason.w*1.4)*smoothstep(.3,.6,n.y)*smoothstep(.2,.5,lnoise(vW.xz*2.3)+uSeason.w*.6));
 float sh=shadowAtN(vW+n*.04,n,.0012),ao=mix(contactAO(vW),1.,clamp((vW.y-uBaseY)/.7,0.,1.)),occ=min(sh,ao);
 vec3 v=normalize(uEye-vW);float sp=pow(max(dot(n,normalize(uSunDir+v)),0.),30.)*.1*occ;
 o=vec4(fogit(shade(c,n,vW,sh,ao,vec4(.1,30.,0.,.3),0.),vW),1.);}`,
  ],
  bwin: [
    `#version 300 es
precision highp float;layout(location=0) in vec3 bPosIn;layout(location=1) in vec3 bNrmIn;layout(location=2) in vec2 bUVIn;layout(location=3) in vec4 bWIn;layout(location=4) in vec3 bTIn;layout(location=5) in vec4 bFIn;
uniform mat4 uVP;uniform vec2 uLift;out vec3 vW;out vec3 vN;out vec2 vUV;out vec4 vWd;out vec3 vT;out vec4 vF;${COMMON_GLSL}
void main(){vec3 p=bPosIn;p.y+=curveY(uLift);vW=p;vN=bNrmIn;vUV=bUVIn;vWd=bWIn;vT=bTIn;vF=bFIn;gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec3 vW;in vec3 vN;in vec2 vUV;in vec4 vWd;in vec3 vT;in vec4 vF;out vec4 o;uniform sampler2D uRooms;uniform float uFade,uNight,uDay,uInt,uLitF;uniform vec3 uSkyR;${LIGHT_GLSL}${BUILDING_RAMP_GLSL}
void main(){if(uFade<.99&&bayer4(gl_FragCoord.xy)>uFade)discard;
 float w=vWd.x,h=vWd.y,room=vWd.z,D=vWd.w;vec3 N=normalize(vN),T=normalize(vT);vec2 p=vec2(vUV.x*w,vUV.y*h);
 vec3 d=normalize(vW-uEye);vec3 ld=vec3(dot(d,T),d.y,max(dot(d,-N),.04));
 /* the room behind the pane: wider and taller than the window, D deep; find which wall the view ray meets first */
 float ex=.75,sill=.85,top=.6,RW=w+2.*ex,RH=h+sill+top;
 float tx=ld.x>.0001?(w+ex-p.x)/ld.x:ld.x<-.0001?(-ex-p.x)/ld.x:1e6;
 float ty=ld.y>.0001?(h+top-p.y)/ld.y:ld.y<-.0001?(-sill-p.y)/ld.y:1e6;
 float tz=D/ld.z;float t=min(tx,min(ty,tz));vec3 q=vec3(p,0.)+ld*t;float dep=clamp(q.z/D,0.,1.);
 vec2 uv;float cell;
 if(t==tz){cell=0.;uv=vec2((q.x+ex)/RW,(q.y+sill)/RH);}
 else if(t==tx){cell=1.;uv=vec2(ld.x>0.?dep:1.-dep,(q.y+sill)/RH);}
 else{cell=ld.y<0.?2.:3.;uv=vec2((q.x+ex)/RW,ld.y<0.?1.-dep:dep);}
 uv=clamp(uv,.001,.999);
 /* alpha 0.4: the room picture at the mip level its size on screen asks for (level 0 always made far rooms shimmer) */
 float pf=length(fwidth(vW))*(1.+dep*1.4),lod=clamp(log2(max(pf*float(textureSize(uRooms,0).x)*.25/RW,1.)),0.,3.);
 vec3 ic=textureLod(uRooms,vec2((cell+uv.x)/4.,(room+1.-uv.y)/8.),lod).rgb;
 /* v32: each window its own light: lit or not by the hour (fewer late at night), warm lamps, cooler kitchens, the odd blue TV flicker */
 /* alpha 0.4: each window has its own seed from the mesh (0-255), the same one frontWindowLight reads for its halo and its light on the ground */
 float wid=floor(vF.w*.5+.01),hh=(wid+.5)/256.,h2=fract(wid*.6180339+.31);float on=step(hh,uLitF)*(.62+.6*h2);
 vec3 lc=h2<.18?vec3(.62,.78,1.25)*(.85+.25*sin(uTime*.009+wid)):h2<.45?vec3(1.15,1.05,.85):vec3(1.25,1.,.7);
 /* by night a warm glow, not a white-out: the lamp's strength is capped and its brightest parts roll off softly */
 vec3 nl=ic*min(uNight,1.3)*on*lc*(1.1-.35*dep);nl=(1.-exp(-nl*1.15))*1.05;
 /* a side or back window seen almost edge-on shows a sliver of its room: dim it, or it reads as a stray white mark */
 nl*=smoothstep(.12,.42,clamp(dot(-d,N),0.,1.));vec3 inside=ic*uDay*(.42+.3*(1.-dep))*(1.-.25*dep)+nl;
 inside=mix(vec3(.08,.09,.12)*uDay,inside,uInt);
 /* glass: sky reflected more at grazing angles, a sun glint where it isn't in shadow */
 float sh=shadowAt(vW+N*.05,.0015),ct=clamp(dot(-d,N),0.,1.),fr=.1+.55*pow(1.-ct,3.);
 vec3 refl=uSkyR*(.5+.5*sh)*(.55+.45*uAmbK);float spec=pow(max(dot(reflect(d,N),uSunDir),0.),90.)*sh*1.4;
 float edge=smoothstep(.06,.32,ct);vec3 c=mix(inside,refl,fr*edge)+uSunCol*spec*edge;
 /* windows on the side and back walls draw their own frame and cross bars */
 if(mod(vF.w,2.)>.5){float fw=.07;if(p.x<fw||p.x>w-fw||p.y<fw||p.y>h-fw||abs(p.x-w*.5)<.03||abs(p.y-h*.56)<.03){float b=p.x<fw*.5||p.y>h-fw*.5?3.:p.y<fw*.5||p.x>w-fw*.5?1.:2.;
  c=shade(rampC(vF.rgb,b),N,vW,sh,1.,vec4(0.,1.,0.,0.),0.);}}
 o=vec4(fogit(c,vW),1.);}`,
  ],
  bfac: [
    `#version 300 es
precision highp float;layout(location=0) in vec2 bCIn;uniform mat4 uVP;uniform vec3 uO,uA,uB;uniform vec2 uLift;out vec2 vUV;out vec3 vW;${COMMON_GLSL}
void main(){vec3 p=uO+uA*bCIn.x+uB*bCIn.y;p.y+=curveY(uLift);vW=p;vUV=vec2(bCIn.x,1.-bCIn.y);gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;in vec3 vW;out vec4 o;uniform sampler2D uTex,uNrm;uniform vec3 uN,uR;uniform float uFade,uFlipN,uBaseY,uGlassN;${LIGHT_GLSL}${BUILDING_RAMP_GLSL}${LOOK_GLSL}uniform vec3 uBP;
void main(){vec4 c=texture(uTex,vUV);if(c.a<.05)discard;if(uFade<.99&&bayer4(gl_FragCoord.xy)>uFade)discard;
 if(c.a>.99)c.rgb=lookOn(c.rgb,floor(vUV*vec2(textureSize(uTex,0))),1.-vUV.y,uBP);
 vec3 nn=texture(uNrm,vUV).xyz*2.-1.;vec3 n=normalize(uR*nn.x*uFlipN+vec3(0.,-nn.y,0.)+uN*max(nn.z,.2));
 float sh=shadowAtN(vW+uN*.06,uN,.001),ao=mix(contactAO(vW),1.,clamp((vW.y-uBaseY)/.7,0.,1.)),occ=min(sh,ao);
 float nl=dot(n,uSunDir),dif=mix(1.,max((nl+.1)/1.1,0.)*.75+.45,.55);vec3 v=normalize(uEye-vW);float sp=pow(max(dot(n,normalize(uSunDir+v)),0.),36.)*.2*occ;
 vec3 lit=shade(c.rgb,normalize(vec3(n.x,max(n.y,.25),n.z)),vW,sh,ao,vec4(.2,36.,0.,.6),0.);
 vec3 col=c.a<.99?mix(c.rgb*.55,lit,.45)*(1.-.45*uGlassN)+uSunCol*sp*2.:lit;o=vec4(fogit(col,vW),c.a<.99?c.a*(1.-.5*uGlassN):1.);}`,
  ],
  bshadow: [
    `#version 300 es
precision highp float;layout(location=0) in vec3 bPosIn;uniform mat4 uVP;uniform vec2 uLift;${COMMON_GLSL}
void main(){vec3 p=bPosIn;p.y+=curveY(uLift);gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;out vec4 o;void main(){o=vec4(1.);}`,
  ],
};
provide({ BUILDING_SHADERS }); /* to-module */
/* ---------- the front picture: roof cut away, glass see-through ---------- */
function hexColorSet(L) {
  return new Set((L || []).map(h => parseInt(h.slice(1, 7), 16)));
}
/* alpha 0.4.1: a building kind's signature worked out once a frame (it was joined into a long string for every building, twice a frame) */
const BUILDING_SIGNATURE_CACHE = new WeakMap();
function cachedBuildingSignature(B) {
  const f = typeof walkRenderer !== 'undefined' ? walkRenderer.frames : 0;
  let c = BUILDING_SIGNATURE_CACHE.get(B);
  if (!c || c.f !== f) {
    c = { f, s: buildingSignature(B) };
    BUILDING_SIGNATURE_CACHE.set(B, c);
  }
  return c.s;
}
function buildingFrontPicture(im, B, M) {
  let F = buildingState.fac.get(im);
  const v =
    (typeof artCacheVersion === 'function' ? artCacheVersion() : 0) +
    '|' +
    cachedBuildingSignature(B) +
    '|' +
    M.ox +
    ',' +
    M.oy;
  if (F && F.v === v) return F.c;
  if (!buildingBudgetLeft()) return null;
  buildingState.n++;
  const w = im.naturalWidth || im.width,
    h = im.naturalHeight || im.height,
    c = makeCanvas(w, h),
    x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(im, 0, 0);
  let id;
  try {
    id = x.getImageData(0, 0, w, h);
  } catch (e) {
    return im;
  }
  const d = id.data,
    roof = hexColorSet(B.roofRamp),
    glass = hexColorSet(B.glass),
    win = B.win || [],
    ox = M.ox,
    oy = M.oy,
    half = Math.max(Math.abs(B.wall[0]), Math.abs(B.wall[1])) + 1;
  for (let y = 0; y < h; y++)
    for (let X = 0; X < w; X++) {
      const k = (y * w + X) * 4;
      if (d[k + 3] < 128) continue;
      const yr = y + oy,
        xr = X + ox,
        col = (d[k] << 16) | (d[k + 1] << 8) | d[k + 2];
      let drop = false;
      if (B.kind === 'flat') {
        if (yr < B.eave && roof.has(col)) drop = true;
      } else if (B.kind === 'gableF') {
        if (yr < B.eave) {
          const lim = ((yr - B.apex) / Math.max(1, B.eave - B.apex)) * half;
          if (yr < B.apex || Math.abs(xr) > lim + 0.5 || roof.has(col)) drop = true;
        }
      } else if (yr <= B.eave) drop = true;
      if (!drop && B.kind !== 'flat' && roof.has(col) && yr <= B.eave + 8) drop = true;
      if (drop) {
        d[k + 3] = 0;
        continue;
      }
      if (glass.has(col) && win.some(r => xr >= r[0] && xr < r[0] + r[2] && yr >= r[1] && yr < r[1] + r[3]))
        d[k + 3] = 76;
    }
  x.putImageData(id, 0, 0);
  c.__mat = 'building';
  buildingState.fac.set(im, { c, v });
  return c;
}
/* ---------- the model ---------- */
const buildingTextureCell = i => [i % 8, Math.floor(i / 8)];
function buildingColor(h, fb) {
  return hexToRgb(typeof h === 'string' && /^#[0-9a-f]{6}/i.test(h) ? h : fb || '#C8C0B0').map(v => v / 255);
}
/* v37: building a model (and cutting a front) is spread over frames: the first of a frame always goes ahead, the rest only
   while the frame has spent under 5 ms on them, so a town with many buildings opens without a long frame (the sun shadow
   cache keys on buildingState.made, so it is redrawn as each one appears) */
function buildingBudgetLeft() {
  const fr = typeof gpuState !== 'undefined' ? gpuState.fr : 0;
  if (buildingState.fr !== fr) {
    buildingState.fr = fr;
    buildingState.t0 = performance.now();
    buildingState.n = 0;
  }
  return buildingState.n === 0 || performance.now() - buildingState.t0 < 5;
}
function buildingMesh(it) {
  const p = it.p,
    M = it.M,
    B = M.build,
    im = it.im,
    key = [
      p.x,
      p.z,
      p.s,
      p.f,
      p.rot || 0,
      it.y,
      it.w,
      it.h,
      it.mpp,
      M.box && M.box[1],
      M.box && M.box[0],
      B.__v || 0,
      cachedBuildingSignature(B),
    ];
  /* alpha 0.4.1: the building's own settings are in the key too, so an edit in the Studio's prop editor shows at once */ /* v44: the picture's size is in the key, so a mesh made before the art loaded is made again; alpha 0.4.1: compared value by value, not joined into a string every frame */ let E =
    buildingState.mesh.get(p);
  if (E && E.B === B && E.im === im && E.key && E.key.every((v, i) => v === key[i])) return E;
  if (!buildingBudgetLeft()) return null;
  buildingState.n++;
  if (E) freeBuildingMesh(E);
  E = makeBuildingModel(it);
  if (!E.walls && !E.wins) return null;
  /* nothing to show yet (the art is still loading): try again next frame */ E.key = key;
  E.B = B;
  E.im = im;
  buildingState.mesh.set(p, E);
  buildingState.made = (buildingState.made || 0) + 1;
  return E;
}
function freeBuildingMesh(E) {
  const gl = gpuState.gl;
  for (const m of [E.walls, E.wins])
    if (m) {
      try {
        gl.deleteVertexArray(m.vao);
        gl.deleteBuffer(m.vb);
        gl.deleteBuffer(m.ib);
      } catch (e) {}
    }
}
/* alpha 0.4: p.rot, a building turned a few degrees (along a curved street, toward its square): it turns about its
   door, the middle of its front, so the door, the way in and the room behind it stay where they were */
function buildingRotation(p, ax, az) {
  const r = ((p.rot || 0) * Math.PI) / 180;
  if (!r) return null;
  const c = Math.cos(r),
    s = Math.sin(r);
  return { c, s, ax, az, pt: (x, z) => [ax + (x - ax) * c - (z - az) * s, az + (x - ax) * s + (z - az) * c] };
}
function makeBuildingModel(it) {
  const p = it.p,
    M = it.M,
    B = M.build,
    s = it.mpp,
    f = it.flip,
    sc = p.s || 1,
    y0 = it.y,
    xw = a => it.x + a * s * f,
    RT = buildingRotation(p, it.x, it.z);
  let XL = xw(B.wall[0]),
    XR = xw(B.wall[1]);
  if (XL > XR) [XL, XR] = [XR, XL];
  const W = XR - XL,
    z0 = it.z,
    D = Math.max(0.6, (M.box ? M.box[1] : 2) * sc),
    z1 = z0 + D,
    xc = (XL + XR) / 2,
    zc = (z0 + z1) / 2;
  let under = y0 - 0.7;
  for (const [a, b] of [
    [XL, z0],
    [XR, z0],
    [XL, z1],
    [XR, z1],
  ]) {
    const q = RT ? RT.pt(a, b) : [a, b];
    under = Math.min(under, standingHeightAt(q[0], q[1]) - 0.5);
  }
  const Ye = y0 - B.eave * s,
    o = (B.over ?? 0.25) * sc,
    pit = ((B.pitch ?? 40) * Math.PI) / 180,
    tp = Math.tan(pit);
  const wallC = buildingColor(B.wallCol),
    roofC = buildingColor(B.roofCol, '#A05040'),
    trimC = buildingColor(B.trimCol, '#7A5440'),
    wallT = buildingTextureCell(B.wallTex ?? 0),
    roofT = buildingTextureCell(B.roofTex ?? 8);
  const base = B.base || { col: '#AAA6B4', tex: 3, h: 0.28 },
    baseC = buildingColor(base.col),
    baseT = buildingTextureCell(base.tex ?? 3),
    baseH = y0 + (base.h ?? 0.28) * sc;
  const V = [],
    I = [];
  const poly = (P, n, uv, tex, col, plain) => {
    const b = V.length / 14;
    P.forEach((q, i) =>
      V.push(
        q[0],
        q[1],
        q[2],
        n[0],
        n[1],
        n[2],
        uv[i][0],
        uv[i][1],
        tex[0],
        tex[1],
        plain ? 1 : 0,
        col[0],
        col[1],
        col[2]
      )
    );
    for (let i = 1; i < P.length - 1; i++) I.push(b, b + i, b + i + 1);
  };
  /* a wall in a vertical plane: points as [u,y] along the wall from its start (a) in direction t; split into foundation and wall */
  const wallPoly = (a, t, n, pts) => {
    const P3 = q => [a[0] + t[0] * q[0], q[1], a[1] + t[1] * q[0]];
    const clipY = (pts, lo, hi) => {
      let out = pts;
      for (const [lim, keepAbove] of [
        [lo, true],
        [hi, false],
      ]) {
        const res = [];
        for (let i = 0; i < out.length; i++) {
          const A = out[i],
            Bq = out[(i + 1) % out.length],
            ina = keepAbove ? A[1] >= lim : A[1] <= lim,
            inb = keepAbove ? Bq[1] >= lim : Bq[1] <= lim;
          if (ina) res.push(A);
          if (ina !== inb) {
            const k = (lim - A[1]) / (Bq[1] - A[1]);
            res.push([A[0] + (Bq[0] - A[0]) * k, lim]);
          }
        }
        out = res;
      }
      return out;
    };
    const lo = clipY(pts, -1e9, baseH),
      hi = clipY(pts, baseH, 1e9);
    if (lo.length > 2)
      poly(
        lo.map(P3),
        n,
        lo.map(q => [q[0], q[1] - y0]),
        baseT,
        baseC
      );
    if (hi.length > 2)
      poly(
        hi.map(P3),
        n,
        hi.map(q => [q[0], q[1] - y0]),
        wallT,
        wallC
      );
  };
  const rect = (u0, u1, yA, yB) => [
    [u0, yA],
    [u1, yA],
    [u1, yB],
    [u0, yB],
  ];
  const fascia = (a, b, dy = 0.14) => {
    const dx = b[0] - a[0],
      dz = b[2] - a[2],
      l = Math.hypot(dx, dz) || 1,
      n = [dz / l, 0, -dx / l];
    poly(
      [[a[0], a[1] - dy, a[2]], [b[0], b[1] - dy, b[2]], b, a],
      n,
      [
        [0, 0],
        [l, 0],
        [l, dy],
        [0, dy],
      ],
      buildingTextureCell(15),
      trimC
    );
  };
  const roofFace = (P, n, uvs) => poly(P, n, uvs, roofT, roofC);
  let roofAt = (x, z) => Ye,
    smoke = null;
  const kind = B.kind || 'hip';
  /* front skirt under the picture where the ground falls away */
  if (under < y0 - 0.05) wallPoly([XL, z0], [1, 0], [0, 0, -1], rect(0, W, under, y0 + 0.02));
  if (kind === 'hip' || kind === 'gable') {
    const along = kind === 'gable' || W >= D; /* ridge along x for a wide house */
    const eY = Ye - o * tp,
      x0 = XL - o,
      x1 = XR + o,
      za = z0 - o,
      zb = z1 + o;
    if (along) {
      const half = (zb - za) / 2,
        rY = eY + half * tp,
        inset = kind === 'hip' ? half : 0,
        rx0 = x0 + inset,
        rx1 = x1 - inset,
        sl = half / Math.cos(pit);
      const nf = normalize3([0, 1, -tp]),
        nb = normalize3([0, 1, tp]);
      roofFace(
        [
          [x0, eY, za],
          [x1, eY, za],
          [rx1, rY, zc],
          [rx0, rY, zc],
        ],
        nf,
        [
          [0, 0],
          [x1 - x0, 0],
          [rx1 - x0, sl],
          [rx0 - x0, sl],
        ]
      );
      roofFace(
        [
          [x1, eY, zb],
          [x0, eY, zb],
          [rx0, rY, zc],
          [rx1, rY, zc],
        ],
        nb,
        [
          [0, 0],
          [x1 - x0, 0],
          [x1 - rx0, sl],
          [x1 - rx1, sl],
        ]
      );
      if (kind === 'hip') {
        const nl = normalize3([-tp, 1, 0]),
          nr = normalize3([tp, 1, 0]);
        roofFace(
          [
            [x0, eY, zb],
            [x0, eY, za],
            [rx0, rY, zc],
          ],
          nl,
          [
            [0, 0],
            [zb - za, 0],
            [half, sl],
          ]
        );
        roofFace(
          [
            [x1, eY, za],
            [x1, eY, zb],
            [rx1, rY, zc],
          ],
          nr,
          [
            [0, 0],
            [zb - za, 0],
            [half, sl],
          ]
        );
        fascia([x0, eY, zb], [x0, eY, za]);
        fascia([x1, eY, za], [x1, eY, zb]);
      } else {
        /* gable ends: the side walls rise to the ridge; rake boards along the roof edge */
        wallPoly(
          [XL, z1],
          [0, -1],
          [-1, 0, 0],
          [
            [0, under],
            [D, under],
            [D, Ye],
            [D / 2, Ye + (D / 2) * tp],
            [0, Ye],
          ]
        );
        wallPoly(
          [XR, z0],
          [0, 1],
          [1, 0, 0],
          [
            [0, under],
            [D, under],
            [D, Ye],
            [D / 2, Ye + (D / 2) * tp],
            [0, Ye],
          ]
        );
        for (const X of [x0, x1]) {
          fascia([X, eY, za], [X, rY, zc]);
          fascia([X, rY, zc], [X, eY, zb]);
        }
      }
      fascia([x0, eY, za], [x1, eY, za]);
      fascia([x1, eY, zb], [x0, eY, zb]);
      /* ridge cap */
      const cw = 0.13,
        cy = 0.035,
        dk = roofC.map(v => v * 0.82);
      poly(
        [
          [rx0, rY + cy, zc - cw],
          [rx1, rY + cy, zc - cw],
          [rx1, rY + cy + 0.05, zc],
          [rx0, rY + cy + 0.05, zc],
        ],
        nf,
        [
          [0, 0],
          [1, 0],
          [1, 0.1],
          [0, 0.1],
        ],
        buildingTextureCell(15),
        dk
      );
      poly(
        [
          [rx1, rY + cy, zc + cw],
          [rx0, rY + cy, zc + cw],
          [rx0, rY + cy + 0.05, zc],
          [rx1, rY + cy + 0.05, zc],
        ],
        nb,
        [
          [0, 0],
          [1, 0],
          [1, 0.1],
          [0, 0.1],
        ],
        buildingTextureCell(15),
        dk
      );
      roofAt = (x, z) => {
        let h = eY + Math.min(z - za, zb - z) * tp;
        if (kind === 'hip') h = Math.min(h, eY + Math.min(x - x0, x1 - x) * tp);
        return Math.min(rY, h);
      };
    } else {
      /* a deep, narrow house: ridge front to back */
      const half = (x1 - x0) / 2,
        rY = eY + half * tp,
        sl = half / Math.cos(pit),
        inset = kind === 'hip' ? half : 0,
        rz0 = za + inset,
        rz1 = zb - inset,
        nl = normalize3([-tp, 1, 0]),
        nr = normalize3([tp, 1, 0]);
      roofFace(
        [
          [x0, eY, zb],
          [x0, eY, za],
          [xc, rY, rz0],
          [xc, rY, rz1],
        ],
        nl,
        [
          [0, 0],
          [zb - za, 0],
          [rz0 - za, sl],
          [rz1 - za, sl],
        ]
      );
      roofFace(
        [
          [x1, eY, za],
          [x1, eY, zb],
          [xc, rY, rz1],
          [xc, rY, rz0],
        ],
        nr,
        [
          [0, 0],
          [zb - za, 0],
          [zb - rz1, sl],
          [zb - rz0, sl],
        ]
      );
      roofFace(
        [
          [x0, eY, za],
          [x1, eY, za],
          [xc, rY, rz0],
        ],
        normalize3([0, 1, -tp]),
        [
          [0, 0],
          [x1 - x0, 0],
          [half, sl],
        ]
      );
      roofFace(
        [
          [x1, eY, zb],
          [x0, eY, zb],
          [xc, rY, rz1],
        ],
        normalize3([0, 1, tp]),
        [
          [0, 0],
          [x1 - x0, 0],
          [half, sl],
        ]
      );
      fascia([x0, eY, za], [x1, eY, za]);
      fascia([x1, eY, zb], [x0, eY, zb]);
      fascia([x0, eY, zb], [x0, eY, za]);
      fascia([x1, eY, za], [x1, eY, zb]);
      roofAt = (x, z) => Math.min(rY, eY + Math.min(x - x0, x1 - x) * tp, eY + Math.min(z - za, zb - z) * tp);
    }
    if (kind === 'hip' || !along) {
      wallPoly([XL, z1], [0, -1], [-1, 0, 0], rect(0, D, under, Ye));
      wallPoly([XR, z0], [0, 1], [1, 0, 0], rect(0, D, under, Ye));
    }
    wallPoly([XR, z1], [-1, 0], [0, 0, 1], rect(0, W, under, Ye));
  } else if (kind === 'gableF') {
    /* ridge front to back, the gable faces you: its triangle is part of the picture */
    const rise = Math.max(0.3, (B.eave - B.apex) * s),
      half = W / 2,
      ptc = Math.atan2(rise, half),
      tq = Math.tan(ptc),
      eY = Ye - o * tq,
      rY = Ye + rise,
      x0 = XL - o,
      x1 = XR + o,
      za = z0 - o,
      zb = z1 + o,
      sl = (half + o) / Math.cos(ptc);
    const nl = normalize3([-tq, 1, 0]),
      nr = normalize3([tq, 1, 0]);
    roofFace(
      [
        [x0, eY, zb],
        [x0, eY, za],
        [xc, rY, za],
        [xc, rY, zb],
      ],
      nl,
      [
        [0, 0],
        [zb - za, 0],
        [zb - za, sl],
        [0, sl],
      ]
    );
    roofFace(
      [
        [x1, eY, za],
        [x1, eY, zb],
        [xc, rY, zb],
        [xc, rY, za],
      ],
      nr,
      [
        [0, 0],
        [zb - za, 0],
        [zb - za, sl],
        [0, sl],
      ]
    );
    fascia([x0, eY, zb], [x0, eY, za]);
    fascia([x1, eY, za], [x1, eY, zb]);
    for (const Z of [za, zb]) {
      fascia([x0, eY, Z], [xc, rY, Z]);
      fascia([xc, rY, Z], [x1, eY, Z]);
    }
    const cw = 0.13,
      dk = roofC.map(v => v * 0.82);
    poly(
      [
        [xc - cw, rY + 0.035, zb],
        [xc - cw, rY + 0.035, za],
        [xc, rY + 0.085, za],
        [xc, rY + 0.085, zb],
      ],
      nl,
      [
        [0, 0],
        [1, 0],
        [1, 0.1],
        [0, 0.1],
      ],
      buildingTextureCell(15),
      dk
    );
    poly(
      [
        [xc + cw, rY + 0.035, za],
        [xc + cw, rY + 0.035, zb],
        [xc, rY + 0.085, zb],
        [xc, rY + 0.085, za],
      ],
      nr,
      [
        [0, 0],
        [1, 0],
        [1, 0.1],
        [0, 0.1],
      ],
      buildingTextureCell(15),
      dk
    );
    wallPoly([XL, z1], [0, -1], [-1, 0, 0], rect(0, D, under, Ye));
    wallPoly([XR, z0], [0, 1], [1, 0, 0], rect(0, D, under, Ye));
    wallPoly(
      [XR, z1],
      [-1, 0],
      [0, 0, 1],
      [
        [0, under],
        [W, under],
        [W, Ye],
        [half, rY],
        [0, Ye],
      ]
    );
    roofAt = (x, z) => Math.min(rY, eY + Math.min(x - x0, x1 - x) * tq);
  } else if (kind === 'shed') {
    const eY = Ye - o * tp,
      rY = Ye + D * tp,
      x0 = XL - o,
      x1 = XR + o,
      za = z0 - o,
      zb = z1 + o,
      sl = (zb - za) / Math.cos(pit),
      n = normalize3([0, 1, -tp]);
    roofFace(
      [
        [x0, eY, za],
        [x1, eY, za],
        [x1, eY + (zb - za) * tp, zb],
        [x0, eY + (zb - za) * tp, zb],
      ],
      n,
      [
        [0, 0],
        [x1 - x0, 0],
        [x1 - x0, sl],
        [0, sl],
      ]
    );
    fascia([x0, eY, za], [x1, eY, za]);
    fascia([x1, eY + (zb - za) * tp, zb], [x0, eY + (zb - za) * tp, zb]);
    fascia([x0, eY + (zb - za) * tp, zb], [x0, eY, za]);
    fascia([x1, eY, za], [x1, eY + (zb - za) * tp, zb]);
    wallPoly(
      [XL, z1],
      [0, -1],
      [-1, 0, 0],
      [
        [0, under],
        [D, under],
        [D, Ye],
        [0, Ye + D * tp],
      ]
    );
    wallPoly(
      [XR, z0],
      [0, 1],
      [1, 0, 0],
      [
        [0, under],
        [D, under],
        [D, Ye + D * tp],
        [0, Ye],
      ]
    );
    wallPoly([XR, z1], [-1, 0], [0, 0, 1], rect(0, W, under, rY));
    roofAt = (x, z) => eY + (z - za) * tp;
  } else {
    /* flat roof behind a parapet */
    const pt = 0.3 * sc,
      th = 0.14,
      rY = Ye - 0.08;
    wallPoly([XL, z1], [0, -1], [-1, 0, 0], rect(0, D, under, Ye + pt));
    wallPoly([XR, z0], [0, 1], [1, 0, 0], rect(0, D, under, Ye + pt));
    wallPoly([XR, z1], [-1, 0], [0, 0, 1], rect(0, W, under, Ye + pt));
    roofFace(
      [
        [XL + th, rY, z0 + 0.02],
        [XR - th, rY, z0 + 0.02],
        [XR - th, rY, z1 - th],
        [XL + th, rY, z1 - th],
      ],
      [0, 1, 0],
      [
        [0, 0],
        [W, 0],
        [W, D],
        [0, D],
      ]
    );
    const tc = buildingTextureCell(15);
    poly(
      [
        [XL, Ye + pt, z0],
        [XL + th, Ye + pt, z0],
        [XL + th, Ye + pt, z1],
        [XL, Ye + pt, z1],
      ],
      [0, 1, 0],
      [
        [0, 0],
        [0.2, 0],
        [0.2, D],
        [0, D],
      ],
      tc,
      trimC
    );
    poly(
      [
        [XR - th, Ye + pt, z0],
        [XR, Ye + pt, z0],
        [XR, Ye + pt, z1],
        [XR - th, Ye + pt, z1],
      ],
      [0, 1, 0],
      [
        [0, 0],
        [0.2, 0],
        [0.2, D],
        [0, D],
      ],
      tc,
      trimC
    );
    poly(
      [
        [XL, Ye + pt, z1 - th],
        [XR, Ye + pt, z1 - th],
        [XR, Ye + pt, z1],
        [XL, Ye + pt, z1],
      ],
      [0, 1, 0],
      [
        [0, 0],
        [W, 0],
        [W, 0.2],
        [0, 0.2],
      ],
      tc,
      trimC
    );
    for (const [a, b, n] of [
      [
        [XL + th, z0],
        [XL + th, z1 - th],
        [1, 0, 0],
      ],
      [
        [XR - th, z1 - th],
        [XR - th, z0],
        [-1, 0, 0],
      ],
      [
        [XL + th, z1 - th],
        [XR - th, z1 - th],
        [0, 0, -1],
      ],
    ]) {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      poly(
        [
          [a[0], rY, a[1]],
          [b[0], rY, b[1]],
          [b[0], Ye + pt, b[1]],
          [a[0], Ye + pt, a[1]],
        ],
        n,
        [
          [0, 0],
          [l, 0],
          [l, pt + 0.08],
          [0, pt + 0.08],
        ],
        buildingTextureCell(15),
        trimC.map(v => v * 0.85)
      );
    }
    /* a roof hatch and a vent so the roof isn't empty */
    const box = (cx, cz, bw, bd, bh, col, tex) => {
      const xa = cx - bw / 2,
        xb = cx + bw / 2,
        za = cz - bd / 2,
        zb = cz + bd / 2,
        yb = rY + bh;
      for (const [P, n, l] of [
        [
          [
            [xa, rY, za],
            [xb, rY, za],
            [xb, yb, za],
            [xa, yb, za],
          ],
          [0, 0, -1],
          bw,
        ],
        [
          [
            [xb, rY, zb],
            [xa, rY, zb],
            [xa, yb, zb],
            [xb, yb, zb],
          ],
          [0, 0, 1],
          bw,
        ],
        [
          [
            [xa, rY, zb],
            [xa, rY, za],
            [xa, yb, za],
            [xa, yb, zb],
          ],
          [-1, 0, 0],
          bd,
        ],
        [
          [
            [xb, rY, za],
            [xb, rY, zb],
            [xb, yb, zb],
            [xb, yb, za],
          ],
          [1, 0, 0],
          bd,
        ],
      ])
        poly(
          P,
          n,
          [
            [0, 0],
            [l, 0],
            [l, bh],
            [0, bh],
          ],
          tex,
          col
        );
      poly(
        [
          [xa, yb, za],
          [xb, yb, za],
          [xb, yb, zb],
          [xa, yb, zb],
        ],
        [0, 1, 0],
        [
          [0, 0],
          [bw, 0],
          [bw, bd],
          [0, bd],
        ],
        tex,
        col.map(v => v * 1.08)
      );
    };
    if (W > 2.4 && D > 1.4) {
      box(XL + W * 0.72, z0 + D * 0.6, 0.7, 0.6, 0.35, [0.62, 0.64, 0.7], buildingTextureCell(6));
      box(XL + W * 0.3, z0 + D * 0.7, 0.5, 0.5, 0.2, trimC, buildingTextureCell(15));
    }
    roofAt = () => rY;
  }
  /* chimney */
  if (B.chimney && kind !== 'flat') {
    const C = B.chimney,
      cx = xw(C.x),
      cw = (C.w || 0.45) * sc,
      cz = kind === 'gableF' ? z0 + D * 0.62 : zc + Math.min(0.35, D * 0.15);
    let top = y0 - C.top * s;
    top = Math.max(top, roofAt(cx, cz) + 0.55);
    const col = buildingColor(C.col, '#B06A50'),
      tx = buildingTextureCell(C.tex ?? 2),
      xa = cx - cw / 2,
      xb = cx + cw / 2,
      za = cz - cw / 2,
      zb = cz + cw / 2,
      yb = Ye - 0.2;
    /* alpha 0.4: a crooked chimney (lean, metres the top stands off to the side as the picture has it) */
    const Ln = (C.lean || 0) * sc * f,
      ta = xa + Ln,
      tb = xb + Ln;
    for (const [P, n] of [
      [
        [
          [xa, yb, za],
          [xb, yb, za],
          [tb, top, za],
          [ta, top, za],
        ],
        [0, 0, -1],
      ],
      [
        [
          [xb, yb, zb],
          [xa, yb, zb],
          [ta, top, zb],
          [tb, top, zb],
        ],
        [0, 0, 1],
      ],
      [
        [
          [xa, yb, zb],
          [xa, yb, za],
          [ta, top, za],
          [ta, top, zb],
        ],
        [-1, 0, 0],
      ],
      [
        [
          [xb, yb, za],
          [xb, yb, zb],
          [tb, top, zb],
          [tb, top, za],
        ],
        [1, 0, 0],
      ],
    ])
      poly(
        P,
        n,
        [
          [0, 0],
          [cw, 0],
          [cw, top - yb],
          [0, top - yb],
        ],
        tx,
        col
      );
    const e = 0.05,
      ca = [ta - e, tb + e, za - e, zb + e],
      cy0 = top - 0.09;
    for (const [P, n] of [
      [
        [
          [ca[0], cy0, ca[2]],
          [ca[1], cy0, ca[2]],
          [ca[1], top, ca[2]],
          [ca[0], top, ca[2]],
        ],
        [0, 0, -1],
      ],
      [
        [
          [ca[0], cy0, ca[3]],
          [ca[0], cy0, ca[2]],
          [ca[0], top, ca[2]],
          [ca[0], top, ca[3]],
        ],
        [-1, 0, 0],
      ],
      [
        [
          [ca[1], cy0, ca[2]],
          [ca[1], cy0, ca[3]],
          [ca[1], top, ca[3]],
          [ca[1], top, ca[2]],
        ],
        [1, 0, 0],
      ],
    ])
      poly(
        P,
        n,
        [
          [0, 0],
          [1, 0],
          [1, 0.1],
          [0, 0.1],
        ],
        buildingTextureCell(15),
        trimC
      );
    poly(
      [
        [ca[0], top, ca[2]],
        [ca[1], top, ca[2]],
        [ca[1], top, ca[3]],
        [ca[0], top, ca[3]],
      ],
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      buildingTextureCell(15),
      [0.16, 0.13, 0.14],
      true
    );
    smoke = [cx + Ln, top + 0.08, cz];
  }
  /* windows: the picture's panes at the front, a few more on the sides and the back */
  const WV = [],
    WI = [],
    rooms = B.rooms && B.rooms.length ? B.rooms : [0],
    h3 = (a, b) => hash2d(Math.round(a * 13 + p.x * 7), Math.round(b * 17 + p.z * 5)),
    Dr = Math.min(2.4, Math.max(1, D * 0.8));
  const FW = [],
    win = (O, T, N, w, h, room, frame, fc) => {
      const seed = Math.floor(h3(O[0] + O[1], O[2]) * 256) % 256,
        flags = (frame ? 1 : 0) + seed * 2,
        b = WV.length / 21;
      if (!frame) FW.push([O[0] + (T[0] * w) / 2, O[1] + h / 2, O[2] + (T[2] * w) / 2, seed]);
      for (const [u, v] of [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ])
        WV.push(
          O[0] + T[0] * u * w,
          O[1] + v * h,
          O[2] + T[2] * u * w,
          N[0],
          N[1],
          N[2],
          u,
          v,
          w,
          h,
          room,
          Dr,
          T[0],
          T[1],
          T[2],
          fc[0],
          fc[1],
          fc[2],
          flags,
          0,
          0
        );
      WI.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
  /* alpha 0.4.1: depth on the walls. A box standing out of a wall (centre on the wall at O, along T, out along N), used
    for sills under the side and back windows, a lintel over them, posts at the corners and a plinth round the foot */
  const slab = (O, T, N, w, h, d, col, tex = buildingTextureCell(15)) => {
    const P = (u, v, n) => [O[0] + T[0] * u + N[0] * n, O[1] + v, O[2] + T[2] * u + N[2] * n],
      a = -w / 2,
      b = w / 2,
      lo = -h / 2,
      hi = h / 2,
      mT = [-T[0], 0, -T[2]];
    poly(
      [P(a, lo, d), P(b, lo, d), P(b, hi, d), P(a, hi, d)],
      N,
      [
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
      ],
      tex,
      col
    );
    poly(
      [P(a, hi, 0), P(a, hi, d), P(b, hi, d), P(b, hi, 0)],
      [0, 1, 0],
      [
        [0, 0],
        [0, d],
        [w, d],
        [w, 0],
      ],
      tex,
      col.map(v => Math.min(1, v * 1.1))
    );
    poly(
      [P(a, lo, 0), P(b, lo, 0), P(b, lo, d), P(a, lo, d)],
      [0, -1, 0],
      [
        [0, 0],
        [w, 0],
        [w, d],
        [0, d],
      ],
      tex,
      col.map(v => v * 0.7)
    );
    poly(
      [P(a, lo, 0), P(a, lo, d), P(a, hi, d), P(a, hi, 0)],
      mT,
      [
        [0, 0],
        [d, 0],
        [d, h],
        [0, h],
      ],
      tex,
      col.map(v => v * 0.85)
    );
    poly(
      [P(b, lo, d), P(b, lo, 0), P(b, hi, 0), P(b, hi, d)],
      T,
      [
        [0, 0],
        [d, 0],
        [d, h],
        [0, h],
      ],
      tex,
      col.map(v => v * 0.85)
    );
  };
  const ledge = (O, T, N, w, h) => {
    const c = [O[0] + (T[0] * w) / 2, 0, O[2] + (T[2] * w) / 2];
    slab([c[0], O[1] - 0.03, c[2]], T, N, w + 0.16, 0.07, 0.11, trimC);
    slab(
      [c[0], O[1] + h + 0.035, c[2]],
      T,
      N,
      w + 0.08,
      0.06,
      0.05,
      trimC.map(v => v * 0.9)
    );
  };
  if (sc > 0.5 && Ye - y0 > 1.2) {
    const pw = 0.11 * sc,
      ph = Ye - under,
      pc = (under + Ye) / 2,
      post = (x, z, T, N) => slab([x, pc, z], T, N, pw, ph, 0.05, trimC);
    post(XL, z0 + pw / 2 + 0.02, [0, 0, 1], [-1, 0, 0]);
    post(XR, z0 + pw / 2 + 0.02, [0, 0, -1], [1, 0, 0]);
    post(XL, z1 - pw / 2, [0, 0, 1], [-1, 0, 0]);
    post(XR, z1 - pw / 2, [0, 0, -1], [1, 0, 0]);
    post(XL + pw / 2, z1, [1, 0, 0], [0, 0, 1]);
    post(XR - pw / 2, z1, [1, 0, 0], [0, 0, 1]);
    const bh = Math.max(0.12, baseH - under),
      bc = under + bh / 2,
      bk = baseC.map(v => v * 0.92);
    slab([XL, bc, (z0 + z1) / 2], [0, 0, -1], [-1, 0, 0], D, bh, 0.05, bk, baseT);
    slab([XR, bc, (z0 + z1) / 2], [0, 0, 1], [1, 0, 0], D, bh, 0.05, bk, baseT);
    slab([(XL + XR) / 2, bc, z1], [-1, 0, 0], [0, 0, 1], W + 0.1, bh, 0.05, bk, baseT);
  }
  for (const r of B.win || []) {
    let xa = xw(r[0]),
      xb = xw(r[0] + r[2]);
    if (xa > xb) [xa, xb] = [xb, xa];
    const yb = y0 - (r[1] + r[3]) * s,
      yt = y0 - r[1] * s;
    win(
      [xa, yb, z0 + 0.025],
      [1, 0, 0],
      [0, 0, -1],
      xb - xa,
      yt - yb,
      rooms[Math.floor(h3(xa, yb) * rooms.length) % rooms.length],
      0,
      trimC
    );
  }
  if (B.sideWin !== false) {
    const fl = Math.max(1, B.floors || 1),
      hs = (Ye - y0) / fl;
    for (let k = 0; k < fl; k++) {
      const ww = Math.min(0.78, hs * 0.32),
        wh = Math.min(1, hs * 0.4),
        yb = y0 + k * hs + hs * 0.36;
      if (wh < 0.35) continue;
      const nS = Math.max(0, Math.floor((D - 0.4) / 1.9));
      for (let i = 0; i < nS; i++) {
        const zz = z0 + (D * (i + 0.5)) / nS - ww / 2,
          rm = rooms[(k + i) % rooms.length];
        win([XL - 0.025, yb, zz + ww], [0, 0, -1], [-1, 0, 0], ww, wh, rm, 1, trimC);
        win([XR + 0.025, yb, zz], [0, 0, 1], [1, 0, 0], ww, wh, rooms[(k + i + 1) % rooms.length], 1, trimC);
        ledge([XL, yb, zz + ww], [0, 0, -1], [-1, 0, 0], ww, wh);
        ledge([XR, yb, zz], [0, 0, 1], [1, 0, 0], ww, wh);
      }
      const nB = Math.max(0, Math.floor((W - 0.4) / 2));
      for (let i = 0; i < nB; i++) {
        const xx = XL + (W * (i + 0.5)) / nB - ww / 2;
        win([xx + ww, yb, z1 + 0.025], [-1, 0, 0], [0, 0, 1], ww, wh, rooms[(k + i) % rooms.length], 1, trimC);
        ledge([xx + ww, yb, z1], [-1, 0, 0], [0, 0, 1], ww, wh);
      }
    }
  }
  if (RT) {
    const { c, s: sn, ax, az } = RT,
      R = (A, st, vecs) => {
        for (let o = 0; o < A.length; o += st) {
          const x = A[o] - ax,
            z = A[o + 2] - az;
          A[o] = ax + x * c - z * sn;
          A[o + 2] = az + x * sn + z * c;
          for (const v of vecs) {
            const a = A[o + v],
              b = A[o + v + 2];
            A[o + v] = a * c - b * sn;
            A[o + v + 2] = a * sn + b * c;
          }
        }
      };
    R(V, 14, [3]);
    R(WV, 21, [3, 12]);
    if (smoke) {
      const q = RT.pt(smoke[0], smoke[2]);
      smoke = [q[0], smoke[1], q[1]];
    }
    for (const f of FW) {
      const q = RT.pt(f[0], f[2]);
      f[0] = q[0];
      f[2] = q[1];
    }
  }
  const gl = gpuState.gl,
    mk = (Vs, Is, attrs, stride) => {
      if (!Is.length) return null;
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(Vs), gl.STATIC_DRAW);
      const ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(Is), gl.STATIC_DRAW);
      let off = 0;
      for (const [l, n] of attrs) {
        gl.enableVertexAttribArray(l);
        gl.vertexAttribPointer(l, n, gl.FLOAT, false, stride * 4, off * 4);
        gl.vertexAttribDivisor(l, 0);
        off += n;
      }
      gl.bindVertexArray(null);
      return { vao, vb, ib, n: Is.length };
    };
  return {
    walls: mk(
      V,
      I,
      [
        [0, 3],
        [1, 3],
        [2, 2],
        [3, 3],
        [4, 3],
      ],
      14
    ),
    wins: mk(
      WV,
      WI,
      [
        [0, 3],
        [1, 3],
        [2, 2],
        [3, 4],
        [4, 3],
        [5, 4],
      ],
      21
    ),
    smoke,
    y0,
    box: [XL, XR, z0, z1, under, Ye],
    fw: FW,
    fn: RT ? [RT.s, -RT.c] : [0, -1],
  };
}
/* alpha 0.4: how many of the windows are lit at this hour (one by one in the evening, fewer late at night) */
function litWindowFraction() {
  const h = typeof environment !== 'undefined' && engineContext.env ? environment.tod : 19;
  return typeof environmentLitFraction === 'function'
    ? environmentLitFraction(h)
    : h >= 17 && h < 22
      ? 0.75
      : h >= 22 || h < 1
        ? 0.55
        : h < 5
          ? 0.18
          : h < 8
            ? 0.45
            : 0.5;
}
/* a front window's light as the window shader decides it from the same seed: null when it is dark, else its strength and colour */
function frontWindowLight(seed, litF) {
  if ((seed + 0.5) / 256 > litF) return null;
  const h2 = (seed * 0.6180339 + 0.31) % 1;
  return { k: 0.62 + 0.6 * h2, c: h2 < 0.18 ? [0.62, 0.78, 1.25] : h2 < 0.45 ? [1.15, 1.05, 0.85] : [1.25, 1, 0.7] };
}
/* ---------- drawing ---------- */
export function buildingItems(items) {
  if (!buildingsOn()) return [];
  if (!buildingState.ready) {
    buildingGuard(() => {
      ensurePrograms(BUILDING_SHADERS);
      buildingState.ready = 1;
    });
    if (buildingState.fail) return [];
  }
  const out = [];
  for (const it of items)
    if (it.bld3 && !(walkRenderer.bt && walkRenderer.bt.hide && walkRenderer.bt.hide.has(it.p))) out.push(it);
  return out;
}
export function drawBuildings(C, X, items, fades) {
  buildingGuard(() => drawBuildingsUnguarded(C, X, items, fades));
}
function drawBuildingsUnguarded(C, X, items, fades) {
  const L = buildingItems(items).filter(it => it.vis !== false);
  buildingState.drawn = L.length;
  if (!L.length) return;
  const gl = gpuState.gl;
  ensurePrograms(BUILDING_SHADERS);
  const A = buildingArt(),
    det = imageTexture(artImage(A.detail), { noNormal: true }),
    rm = imageTexture(artImage(A.rooms), { noNormal: true });
  if (!det || !rm) return;
  const sc = walkView.sc,
    dark = sc.tint && sc.tint !== '#000000' ? 1 : sc.indoor ? 0.7 : 0,
    lift = it => [it.x, it.z];
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  let p = useWalkProgram('bld', C, X);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, det.t);
  gl.uniform1i(p.U.uDet, 0);
  gl.uniform2fv(p.U.uAtl, buildingTextureGrid(A));
  for (const it of L) {
    const E = buildingMesh(it);
    if (!E || !E.walls) continue;
    gl.uniform2fv(p.U.uLift, lift(it));
    gl.uniform1f(p.U.uFade, fades.get(it) ?? 1);
    gl.uniform1f(p.U.uBaseY, E.y0);
    if (typeof setPropLookUniforms === 'function') setPropLookUniforms(p.U, it.lk, [it.x, it.y, it.z]);
    gl.bindVertexArray(E.walls.vao);
    gl.drawElements(gl.TRIANGLES, E.walls.n, gl.UNSIGNED_INT, 0);
  }
  p = useWalkProgram('bwin', C, X);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, rm.t);
  gl.uniform1i(p.U.uRooms, 0);
  const sky = (sc.sky || ['#8CC6E6', '#BFE3EE'])[1];
  gl.uniform3fv(
    p.U.uSkyR,
    hexToRgb(sky).map(v => v / 255)
  );
  /* alpha 0.4: a room whose lamp is off is dark at night (it showed at daylight brightness, so unlit windows looked lit) */ gl.uniform1f(
    p.U.uDay,
    sc.indoor
      ? 0.7
      : 1 - 0.8 * (dark ? 1 : typeof environment !== 'undefined' && engineContext.env ? environment.night : 0)
  );
  gl.uniform1f(
    p.U.uNight,
    (dark ? 1 : engineSetting('lights', 'windowsDay') * 2.2) * engineSetting('lights', 'brightness')
  );
  gl.uniform1f(p.U.uInt, engineSetting('world', 'interiors') === false ? 0 : 1);
  if (p.U.uLitF)
    gl.uniform1f(
      p.U.uLitF,
      litWindowFraction()
    ); /* v47: windows come on one at a time in the evening and go off one at a time at night (environment.js environmentLitFraction) */
  for (const it of L) {
    const E = buildingState.mesh.get(it.p);
    if (!E || !E.wins) continue;
    gl.uniform2fv(p.U.uLift, lift(it));
    gl.uniform1f(p.U.uFade, fades.get(it) ?? 1);
    gl.bindVertexArray(E.wins.vao);
    gl.drawElements(gl.TRIANGLES, E.wins.n, gl.UNSIGNED_INT, 0);
  }
  gl.bindVertexArray(null);
  /* fronts last, blended, so the glass shows the rooms behind it */
  p = useWalkProgram('bfac', C, X);
  bindQuad();
  gl.enable(gl.BLEND);
  if (p.U.uGlassN)
    gl.uniform1f(
      p.U.uGlassN,
      dark
        ? 1
        : typeof environment !== 'undefined' && engineContext.env && !sc.indoor
          ? Math.min(1, environment.lampK * 1.2)
          : 0
    );
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.uniform1i(p.U.uTex, 0);
  gl.uniform1i(p.U.uNrm, 1);
  gl.uniform3f(p.U.uN, 0, 0, -1);
  gl.uniform3f(p.U.uR, 1, 0, 0);
  for (const it of L) {
    if (!buildingState.mesh.get(it.p)) continue;
    const F = buildingFrontPicture(it.im, it.M.build, it.M);
    if (!F) continue;
    F.__mat = 'building';
    const T = imageTexture(F);
    if (!T) continue;
    const s = it.mpp,
      w = it.w * s,
      h = it.h * s,
      x0 = it.x + it.ox * s * it.flip;
    /* alpha 0.4.1: a turned building's front picture turns with its walls and roof, about the same point (the middle of its
     front); it stayed square to the street, so the turned roof and side walls cut through it */
    const rr = ((it.p.rot || 0) * Math.PI) / 180,
      rc = Math.cos(rr),
      rs = Math.sin(rr);
    gl.uniform3f(p.U.uO, it.x + (x0 - it.x) * rc, it.y + (-it.oy - it.h) * s, it.z + (x0 - it.x) * rs);
    gl.uniform3f(p.U.uA, w * it.flip * rc, 0, w * it.flip * rs);
    gl.uniform3f(p.U.uN, rs, 0, -rc);
    gl.uniform3f(p.U.uR, rc, 0, rs);
    gl.uniform3f(p.U.uB, 0, h, 0);
    gl.uniform2fv(p.U.uLift, lift(it));
    gl.uniform1f(p.U.uFade, fades.get(it) ?? 1);
    gl.uniform1f(p.U.uFlipN, it.flip);
    gl.uniform1f(p.U.uBaseY, it.y);
    if (typeof setPropLookUniforms === 'function') setPropLookUniforms(p.U, it.lk, [it.x, it.y, it.z]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, T.t);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, T.n);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  gl.disable(gl.BLEND);
}
/* the sun shadow map: walls, roofs and chimneys as geometry (the fronts are drawn by the caller as cut-outs) */
function drawBuildingShadows(SH, items) {
  buildingGuard(() => drawBuildingShadowsUnguarded(SH, items));
}
function drawBuildingShadowsUnguarded(SH, items) {
  const L = buildingItems(items);
  if (!L.length) return;
  const gl = gpuState.gl;
  ensurePrograms(BUILDING_SHADERS);
  const p = gpuState.P.bshadow;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
  const ca = worldCurveArgs();
  gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
  gl.uniform1f(p.U.uCurveD0, ca[3]);
  for (const it of L) {
    const E = buildingMesh(it);
    if (!E || !E.walls) continue;
    gl.uniform2f(p.U.uLift, it.x, it.z);
    gl.bindVertexArray(E.walls.vao);
    gl.drawElements(gl.TRIANGLES, E.walls.n, gl.UNSIGNED_INT, 0);
  }
  gl.bindVertexArray(null);
}
function chimneySmoke(it) {
  const E = it.bld3 && buildingState.mesh.get(it.p);
  return E && E.smoke;
}
