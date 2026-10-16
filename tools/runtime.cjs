// Canvas-only build/test environment. No browser, network, or game engine fork.
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const {createCanvas,Image,ImageData}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/@napi-rs/canvas' : '@napi-rs/canvas');
function context(){
 const c={console,Image,ImageData,Uint8ClampedArray,Uint32Array,Float32Array,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame(){},performance:{now:()=>0},matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null,setItem(){}},document:{createElement:tag=>{if(tag==='canvas')return createCanvas(1,1);return {style:{},setAttribute(){},appendChild(){}}},addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],documentElement:{dataset:{}},baseURI:'http://localhost/'},URL,location:{protocol:'http:'},innerWidth:400,innerHeight:850,addEventListener(){}};
 c.window=c;return vm.createContext(c);
}
function load(c,root,files){for(const f of files)vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});}
module.exports={context,load,vm,fs,path,createCanvas};
