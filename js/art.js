'use strict';
/* ================= ART: every picture in the game comes from a file in art/ =================
   art/manifest.js lists atlas rectangles and battle layouts; art/rigs.js holds billionaire skeletons.
   Images load once and are cached; pixel arrays (for the 3D ground and the world map) are read on demand. */
const ARTDIR=window.NW_ARTDIR||'art/';
/* the address of an art file; a single-file build carries its art inline in window.NW_ART */
const artURL=p=>(window.NW_ART&&window.NW_ART[p])||ARTDIR+p;
const ART={img:{},wait:{},pix:{}};
function artImg(path){if(ART.img[path])return ART.img[path];const im=new Image();im.decoding='async';im.__path=path;ART.img[path]=im;
 ART.wait[path]=new Promise(res=>{im.onload=()=>res(im);im.onerror=()=>{console.error('Missing art file: '+path);res(im)}});im.src=artURL(path);return im}
function artLoad(paths){return Promise.all(paths.map(p=>{artImg(p);return ART.wait[p]}))}
const artReady=path=>{const im=ART.img[path];return !!(im&&im.complete&&im.naturalWidth)};
/* pixel data as packed RGBA words; needs the page to be served over http(s) */
async function artPixels(path){if(ART.pix[path])return ART.pix[path];await artLoad([path]);const im=ART.img[path],c=cnv(im.naturalWidth,im.naturalHeight),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);
 let d;try{d=x.getImageData(0,0,c.width,c.height).data}catch(e){throw new Error('The browser blocked reading '+path+'. Open the game through a local web server (see README).')}
 return ART.pix[path]=new Uint32Array(d.buffer.slice(0))}
/* ---- small color helpers shared by the renderers ---- */
const PX={};
function cnv(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
function rgb(h){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]}
function shadeHex(h,f){const c=rgb(h).map(v=>clamp(Math.round(f>1?v+(255-v)*(f-1):v*f),0,255));return '#'+c.map(v=>v.toString(16).padStart(2,'0')).join('')}
function lum(h){const [r,g,b]=rgb(h);return (0.299*r+0.587*g+0.114*b)/255}
const hexA=h=>{if(Array.isArray(h))return h;const n=parseInt(h.slice(1,7),16);return [(n>>16)&255,(n>>8)&255,n&255]};
const mixA=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
function mixHex(a,b,t){const c=mixA(hexA(a),hexA(b),t);return '#'+c.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('')}
const pk=(r,g,b)=>(255<<24)|((b&255)<<16)|((g&255)<<8)|(r&255);
const pkh=h=>{const c=hexA(h);return pk(c[0],c[1],c[2])};
const B44=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const d44=(x,y)=>B44[(x&3)+((y&3)<<2)]/16;
function seeded(n){let s=n>>>0||1;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
/* ---- icons: one atlas, sliced on request ---- */
const ICON_ATLAS='icons/icons.png';
function iconCanvas(key,scale=1){const k=key+'|'+scale;if(PX[k])return PX[k];const r=ARTMAN.icons[key];if(!r)return cnv(1,1);const c=cnv(r[2]*scale,r[3]*scale),x=c.getContext('2d');x.imageSmoothingEnabled=false;
 if(!artReady(ICON_ATLAS))return c;x.drawImage(ART.img[ICON_ATLAS],r[0],r[1],r[2],r[3],0,0,r[2]*scale,r[3]*scale);return PX[k]=c}
function iconURL(key,scale=1){const k='u'+key+scale;return PX[k]||(PX[k]=iconCanvas(key,scale).toDataURL())}
function mstamp(k){return iconCanvas('map_'+k)}
const UIURL=k=>window.NW_ART&&window.NW_ART[`ui/${k}.svg`]?window.NW_ART[`ui/${k}.svg`]:new URL(`${ARTDIR}ui/${k}.svg`,document.baseURI).href;
function uiIco(key,size=22){return `<i class="uico" style="--ico:url('${UIURL(key)}');width:${size}px;height:${size}px" aria-hidden="true"></i>`}
/* ---- tints of any image (white flash, silhouettes) ---- */
function tintOf(c,col){const w=c.naturalWidth||c.width,h=c.naturalHeight||c.height,t=cnv(w,h),x=t.getContext('2d');x.drawImage(c,0,0);x.globalCompositeOperation='source-in';x.fillStyle=col;x.fillRect(0,0,w,h);return t}
function whiteOf(c){return c._w||(c._w=tintOf(c,'#FFFFFF'))}
function darkOf(c){return c._d||(c._d=tintOf(c,'#0E1418'))}
/* ---- people are drawn in code by trainer.js ---- */
/* ---- coins and Seed Rounds ---- */
const COIN_KINDS=typeof COINS!=='undefined'?Object.keys(COINS):['penny','silver','gold','tbtf'];
const COIN_ART=COIN_KINDS.flatMap(k=>[`coins/${k}_16.png`,`coins/${k}_32.png`]);
function coinCanvas(kind='penny',size=16){return ART.img[`coins/${kind}_${size>=32?32:16}.png`]||artImg(`coins/${kind}_16.png`)}
function coinURL(kind,size=16){return artURL(`coins/${kind}_${size>=32?32:16}.png`)}
function coinHTML(kind,css=32,size=16){return `<img class="pxi" src="${coinURL(kind,size)}" width="${css}" height="${css}" alt="">`}
const EGG_ART=[2,5,10].flatMap(t=>[`eggs/egg_${t}.png`,`eggs/egg_${t}_cracked.png`]);
function eggCanvas(tier,crack){return ART.img[`eggs/egg_${tier}${crack?'_cracked':''}.png`]}
function eggHTML(tier,css=40,cls=''){return `<img class="pxi ${cls}" src="${artURL(`eggs/egg_${tier}.png`)}" width="${css}" height="${Math.round(css*24/20)}" alt="">`}
/* ---- menu background ---- */
const BG_ART=['light','dark'].flatMap(m=>[`background/sky_${m}.png`,...[0,1,2,3].map(i=>`background/cloud_${m}_${i}.png`)]);
/* everything the menus need before the first screen draws */
function artBoot(){return artLoad([ICON_ATLAS,...COIN_ART,...EGG_ART,...BG_ART])}
