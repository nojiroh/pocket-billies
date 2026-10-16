/* ================= PIXEL ART ENGINE ================= */
const ICPAL={k:'#283044',w:'#FFFFFF',g:'#cbd9da',G:'#7E8890',d:'#3A3F45',y:'#F4C542',Y:'#B9801C',r:'#D9434B',R:'#8E2230',b:'#528ec4',B:'#23357A',c:'#8FD8FF',n:'#9A6230',N:'#5E3816',p:'#EF7FA6',P:'#A33A63',v:'#AE8AEC',V:'#5A2E9C',e:'#64ba88',E:'#237546',o:'#F59A2A',O:'#B85E10',s:'#F6D7B0',m:'#FFF1B8',l:'#24201E'};
const ICONS={
 laptop:["..kkkkkkk..","..kbbbbbk..","..kbcbbbk..","..kbbbbbk..","..kkkkkkk..",".kgggggggk.","kkkkkkkkkkk"],
 horn:["....k....","...kmk...","...kyk...","..kmmYk..","..kyyyk..",".kmmmmYk.",".kyyyyyk.","kkkkkkkkk"],
 barrel:[".kkkkkkk.","kgGGGGGgk","kkkkkkkkk","kbbbbbbBk","kBBBBBBBk","kbbbbbbBk","kkkkkkkkk","kbbbbbbBk",".kkkkkkk."],
 crest:["kkkk.......","krrRkkk....",".kRrrrRkk..","..kkRRrrRk.","....kkkkkkk"],
 paperhat:[".....k.....","....kwk....","...kwwgk...","..kwgwwgk..",".kwwwgwwgk.","kkkkkkkkkkk","kwgwgwgwgwk","kkkkkkkkkkk"],
 mic:["..kkk..",".kgGgk.",".kGgGk.",".kgGgk.","..kkk..","...k...","...k...",".kkkkk."],
 dish:["k.......k","kgk...kgk",".kgkkkgk.","..kgggk..","...kyk...","....k....","...kkk..."],
 phone:[".kkkkk.","kdddddk","kdcccdk","kdcbcdk","kdcccdk","kdcccdk","kddwddk",".kkkkk."],
 rocket:["....k....","...kwk...","..kwwwk..","..kwbwk..","..kwwwk..",".kkwwwkk.","krkwwwkrk","kk.kok.kk","....o...."],
 planet:["...kkkkk...","..kooooOk..","kkkooooOkkk","kyykkkkkyyk",".kkooooOkk.","..kOOOOOk..","...kkkkk..."],
 box:[".kkkkkkkkk.","knnnnynnnnk","kNNNNyNNNNk","kkkkkkkkkkk","knnnnnnnnNk","knnnnnnnnNk","kNNNNNNNNNk","kkkkkkkkkkk"],
 truck:["kkkkkkk....","kwwwwwkkkk.","kwrwwwkcck.","kwwwwwkcckk","kkkkkkkkkkk",".kGk...kGk.","..k.....k.."],
 ufo:["....kkk....","...kcccck..","..kkkkkkkk.",".kgggggggk.","kGyGyGyGyGk",".kkkkkkkkk.","..y..y..y.."],
 thumb:["....kk...","...kbbk..","...kbk...",".kkkbbkkk","kbbbbbbbk","kBbbbbbbk","kbbbbbbbk","kkkkkkkkk"],
 eye:["..kkkkk..",".kwwwwwk.","kwwbbbwwk","kwwbkbwwk","kwwbbbwwk",".kwwwwwk.","..kkkkk.."],
 goggles:["kkkkkkkkkkkk","kddddddddddk","kdcccddcccdk","kdcwcddcwcdk","kddddddddddk","kkkkkkkkkkkk"],
 floppy:["kkkkkkkkk","kbgggggbk","kbgggggbk","kbbbbbbbk","kbbwwwbbk","kbbwdwbbk","kkkkkkkkk"],
 window:["kkkkkkkkkk","kbbbbbbbbk","kkkkkkkkkk","kcccckccck","kcccckccck","kkkkkkkkkk","kcccckccck","kcccckccck","kkkkkkkkkk"],
 globe:["..kkkkk..",".kbbeebk.","kbeeebbbk","kbbeebbek","kbbbbeeek",".kbeebbk.","..kkkkk.."],
 soda:[".....k..","....k...",".kkkkkk.",".krrrrk.",".kwwwwk.",".krrrrk.","..krrk..","..kkkk.."],
 burger:["..kkkkkkk..",".knnnnnnnk.","knnmnnmnnnk","kkkkkkkkkkk","keeeeeeeeek","kNNNNNNNNNk","knnnnnnnnnk",".kkkkkkkkk."],
 orb:["..kkkkk..",".kcwccvk.","kcwccccvk","kcccccvvk",".kcvvvvk.","..kkkkk..",".kYyyyYk.","kkkkkkkkk"],
 bag:["...kkkkk...","..k.....k..",".kkkkkkkkk.","kpppppppppk","kpypypypypk","kpppppppppk","kPPPPPPPPPk","kkkkkkkkkkk"],
 ring:["....kk....","...kcwk...","...kcck...","..kkkkkk..",".ky....yk.",".ky....yk.","..kyyyyk..","...kkkk..."],
 crown:["k....k....k","ky..kyk..yk","kyykyyykyyk","kyyyyyyyyyk","kyryyyyyryk","kyyyyyyyyyk","kkkkkkkkkkk"],
 diamond:[".kkkkkkk.","kcwccwcck","kkkkkkkkk",".kccwcck.","..kcwck..","...kck...","....k...."],
 moon:["..kkkk..",".kmmyyk.","kmmyykk.","kmmyk...","kmmyk...","kmmyykk.",".kmmyyk.","..kkkk.."],
 dice:[".kkkkkkk.","kwwwwwwwk","kwkwwwwwk","kwwwwwwwk","kwwwkwwwk","kwwwwwwwk","kwwwwwkwk","kwwwwwwwk",".kkkkkkk."],
 mega:[".......kk",".....kkrk","..kkkrrrk","kkwkrrrrk","kwwkrrrrk","kkwkrrrrk","..kkkrrrk",".....kkrk",".......kk"],
 paper:["kkkkkkkkkk","kwwwwwwwwk","kwddwgggwk","kwddwwwwwk","kwwwwgggwk","kwgggwgggk","kwwwwwwwwk","kkkkkkkkkk"],
 tv:["..k...k..","...k.k...","kkkkkkkkk","kdcccccdk","kdcwcccdk","kdcccccdk","kkkkkkkkk",".k.....k."],
 chart:["kkkkkkkkkk","kwwwwwwwwk","kwrwwwwwwk","kwwrwwwwwk","kwwwrwrwwk","kwwwwrwrwk","kwwwwwwwrk","kkkkkkkkkk"],
 calc:["kkkkkkkkk","kdddddddk","kdcccccdk","kdddddddk","kdgdgdgdk","kdddddddk","kdgdgdrdk","kdddddddk","kkkkkkkkk"],
 whale:["k.........k","kbk.....kbk","kbbk...kbbk",".kbbk.kbbk.","..kbbkbbk..","...kbbbk...","....kbk....","....kbk...."],
 pick:["..kkkkkkk..",".kgggggggk.","kgk.knk.kgk","kk..knk..kk","....knk....","....knk....","....knk....","....kkk...."],
 cowboy:["...kkkkk...","..knnnnnk..","..knNNNnk..","..kNNNNNk..","kkkkkkkkkkk","knnnnnnnnnk",".kkkkkkkkk."],
 tophat:["..kkkkkkk..","..kdddddk..","..kdddddk..","..kdddddk..","..krrrrrk..","kkkkkkkkkkk","kdddddddddk","kkkkkkkkkkk"],
 key:[".kkk........","kyyyk.......","ky.ykkkkkkk.","kyyyyyyyyyyk",".kkk.kyk.kyk",".....kk..kk."],
 building:["kkkkkkkkk","kgggggggk","kgcgcgcgk","kgggggggk","kgcgcgcgk","kgggggggk","kggknkggk","kkkkkkkkk"],
 skyline:["....kkk....","....kck.kk.",".kk.kgk.kgk",".kgkkgkkkgk","kkcgkgkgkck","kgcgkckgkck","kkkkkkkkkkk"],
 bottle:["...k...","..kpk..",".kkkkk.",".kwwwk.",".kwcwk.",".kwcwk.",".kwwwk.",".kkkkk."],
 glass:[".kkkkk.","kyymyyk","kymyyyk",".kyyyk.","..kyk..","...k...","...k...",".kkkkk."],
 yacht:["....k......","....kwk....","....kwwk...","....kwwwk..","....kkkkkk.","kkkkkkkkkkk","kwwwwwwwwwk",".kbbbbbbbk.","..kkkkkkk.."],
 balloon:["..kkkk..",".krrwrk.","krrrrwrk","krrrrrrk",".krrrrk.","..kkkk..","...kk...","....k..."],
 palm:[".kkk.kkk.","keeekeeek","..keeek..","...knk...","...knk...",".kymmmyk.","kkkkkkkkk"],
 sat:["kkk.....kkk","kbk.kkk.kbk","kbkkdgdkkbk","kbk.kgk.kbk","kkk..k..kkk",".....k.....","....kyk...."],
 cart:["k..........","kk.........",".kkkkkkkkkk",".kgkgkgkgk.",".kgkgkgkgk.",".kkkkkkkkk.","..kk...kk.."],
 tag:["...kkkkkkk","..kyyyyyyk",".kyykyyyyk","kyyyyyyyyk",".kyyyyyyyk","..kyyyyyyk","...kkkkkkk"],
 warehouse:["....kkk....","..kkgggkk..","kkgggggggkk","kgggggggggk","kgkkkkkkkgk","kgkdddddkgk","kgkdddddkgk","kkkkkkkkkkk"],
 hanger:["....kk.....","...k..k....","......k....",".....k.....","...kkkkk...",".kk.....kk.","kkkkkkkkkkk"],
 shades:["kkkkkkkkkkk","kddddkddddk","kdcddkdcddk",".kddk.kddk.","..kk...kk.."],
 sparkle:[".....k.....","....kyk....","....kyk....",".kkkkwkkkk.","kyyywwwyyyk",".kkkkwkkkk.","....kyk....","....kyk....",".....k....."],
 cup:["..k.k....","...k.k...",".kkkkkk..",".kwwwwkkk",".knnnnk.k",".kwwwwkkk",".kwwwwk..","..kkkk..."],
 bean:["..kkkk..",".knnnnk.","knnnNnnk","knnNnnnk","knnNnnnk","knNnnnnk",".knnnnk.","..kkkk.."],
 frappe:["....k...","....k...",".kkkkkk.",".kwwwwk.",".kmmmmk.",".kmnnmk.","..kmmk..","..kkkk.."],
 kiosk:["kkkkkkkkkkk","krwrwrwrwrk","kkkkkkkkkkk",".kgk...kgk.",".kgkkkkkgk.",".knnnnnnnk.",".kkkkkkkkk."],
 anchor:["....kkk....","....kgk....","..kkkgkkk..","....kgk....","k...kgk...k","kgk.kgk.kgk",".kgkkgkkgk.","..kgggggk..","...kkkkk..."],
 escal:["........kkk","......kkggk","....kkggggk","..kkggggggk","kkggggggggk","kkkkkkkkkkk"],
 sneaker:["..kkk......",".kwwwk.....",".kwrwkkk...",".kwwwwwwkk.","kkrwwwwwwwk","kgggggggggk","kkkkkkkkkkk"],
 shoebox:["kkkkkkkkkk","kookkkkook","kkkkkkkkkk","koowwwwook","koowwwwook","kooooooook","kkkkkkkkkk"],
 flame:["....k......","...kok.....","...kook.k..","..koyokkok.",".koyyyooook",".koyyyyyok.",".kooyyyook.","..kooooook.","...kkkkkk.."],
 mask:["..kkkkkkk..",".kwwwwwwwk.","kwkkwwwkkwk","kwwwwwwwwwk","kwwkwwwkwwk",".kwwwkwwwk.","..kkkkkkk.."],
 // items
 i_taxbreak:["kkkkkkkkk","kwwwwwwwk","kwdddwwwk","kwwwwwwwk","kwdddddwk","kwwwwwwwk","kwddwyywk","kwwwwyywk","kwkwkwkwk","k.k.k.k.k"],
 i_loophole:["kkkkkkkkk","kwwwwwwwk","kwwkkkwwk","kwklllkwk","kwklllkwk","kwwkkkwwk","kwwwwwwwk","kkkkkkkkk"],
 i_apology:["..kkk......",".kdddk.....","kkkkkkkkk.k","kdddddddkkk","kdcccdddkkk","kdcwcdddkkk","kdcccdrdk.k","kkkkkkkkk.."],
 i_settlement:["kkkkkkkkk","kwwwwwwwk","kwdddddwk","kwwwwwwwk","kwdddwwwk","kwwwwwwwk","kwwwbbbwk","kwwbwwwwk","kkkkkkkkk"],
 i_appeal:["..kkkkk....",".knnnnnk...",".kNNNNNk...","..kkkkkkk..","....knk.k..",".....knk...","......knk..",".......knk.","kkkkk...kk.","kgggk......","kkkkk......"],
 i_bailout:["...kkkkk...","..krrwrrk..",".krwkkkwrk.",".kwk...kwk.",".krk...krk.",".kwk...kwk.",".krwkkkwrk.","..krrwrrk..","...kkkkk..."],
 i_bell:[".....k.....","....kyk....","...kyyYk...","..kyyyyYk..","..kyyyyYk..",".kyyyyyyYk.","kkkkkkkkkkk","....kYk....",".....k....."],
 // particles
 dollar:["..E..",".eeee","e.E..",".eee.","..E.e","eeee.","..E.."],
 coin:[".kkk.","kyyyk","kyYyk","kyyyk",".kkk."],
 vcoin:[".kkk.","kvvvk","kvVvk","kvvvk",".kkk."],
 drop:[".l.","lll","llw","lll",".l."],
 cbox:["kkkkk","knynk","knnnk","kkkkk"],
 bubble:[".kkkkk.","kwwwwwk","kwkwkwk","kwwwwwk",".kkkwkk","....kk."],
 bolt:["...yk","..yk.",".yyyk","yyyk.","..yk.",".yk..","yk..."],
 spark:["..y..",".yYy.","yYwYy",".yYy.","..y.."],
 star:["..w..","..w..","wwwww",".www.","w...w"],
 brick:["rrrrrR","rRrrrR","RRRRRR"],
 bit:["ccc","cbc","ccc"],
 pow:["w..w..w",".w.w.w.","..www..","wwwwwww","..www..",".w.w.w.","w..w..w"],
 up:["..c..",".ccc.","ccccc","..c..","..c.."],
 down:["..r..","..r..","rrrrr",".rrr.","..r.."],
 sheet:["wwww","wggw","wwww","wggw","wwww"],
 zz:["VVVV","..V.",".V..","VVVV"],
 excl:["rr","rr","rr","rr","..","rr"],
 plus:["..e..","..e..","eeeee","..e..","..e.."],
 gem:[".vvv.","vvwvv",".vvv.","..v.."],
 heart:[".rr.rr.","rrrrrrr","rrrrrrr",".rrrrr.","..rrr..","...r..."],
};
const UIICO={
 walk:["............","....kkkk....","...kkkkkk...","...kkkkkk...","...kkkkkk...","....kkkk....","............","....kkkk....","...kkkkkk...","...kkkkkk...","....kkkk....","............"],
 map:["....kkkk....","...kkkkkk...","..kkk..kkk..","..kk....kk..","..kk....kk..","..kkk..kkk..","...kkkkkk...","...kkkkkk...","....kkkk....",".....kk.....","............","..kkkkkkkk.."],
 team:["............","..kkk...kkk.",".kkkkk.kkkkk",".kkkkk.kkkkk","..kkk...kkk.","............",".kkkkk.kkkkk","kkkkkkkkkkkk","kkkkkkkkkkkk","kkkkkkkkkkkk","............","............"],
 ledger:["............","kkkkk..kkkkk","k...kkkk...k","k.kk.kk.kk.k","k...k..k...k","k.kk.kk.kk.k","k...k..k...k","k...k..k...k","kkkkkkkkkkkk","............"],
 mint:["...kkkkkk...","..k......k..",".k...kk...k.",".k..kkkk..k.",".k..k.....k.",".k..kkkk..k.",".k.....k..k.",".k..kkkk..k.",".k...kk...k.","..k......k..","...kkkkkk..."],
 gear:["....kkkk....",".k..k..k..k.","..kkkkkkkk..",".kk......kk.","kkk..kk..kkk","k...k..k...k","kkk..kk..kkk",".kk......kk.","..kkkkkkkk..",".k..k..k..k.","....kkkk...."],
};
const RAMP={
 Tech:['#121A36','#22347A','#2F52B0','#4A7BE0','#7FA6F5','#C8DAFF'],
 Crypto:['#1C0F31','#3D1F6B','#5A2E9C','#7E4CC9','#A985E8','#DDCCFF'],
 Oil:['#0A0807','#1E1814','#2E241E','#41342D','#64534A','#94806F'],
 Retail:['#38200A','#8A4A0E','#BF6E15','#E39A2D','#F5C063','#FFE7A8'],
 Media:['#30091A','#6E1736','#A02B52','#C93F6E','#E9739A','#FFC4D6'],
 Finance:['#06200F','#145032','#1F6E45','#2F855A','#55B07E','#AEE8C6'],
 Dynasty:['#2B1D05','#6B4E14','#957022','#C29B45','#E2C277','#FFF2C6'],
 Space:['#070A1C','#141C46','#1F2A63','#2E3E80','#5064AE','#98A8E6'],
 Property:['#2B0D05','#6B2414','#913523','#B44E35','#D97A5E','#F7C2AA'],
 Gold:['#3A2405','#7A4E0B','#B8801A','#E2A72E','#F5CE6A','#FFF5C8'],
};
const SHAPES={
 round:{d:'M50 30C72 30 84 44 84 62C84 80 70 90 50 90C30 90 16 80 16 62C16 44 28 30 50 30Z',ey:56},
 pear:{d:'M50 22C66 22 72 36 74 50C84 62 82 90 50 90C18 90 16 62 26 50C28 36 34 22 50 22Z',ey:50},
 tall:{d:'M50 18C66 18 72 28 72 44L72 76C72 86 64 90 50 90C36 90 28 86 28 76L28 44C28 28 34 18 50 18Z',ey:44},
 square:{d:'M30 32L70 32C78 32 82 36 82 44L82 80C82 87 78 90 70 90L30 90C22 90 18 87 18 80L18 44C18 36 22 32 30 32Z',ey:54},
 egg:{d:'M50 20C70 20 80 46 80 62C80 80 68 90 50 90C32 90 20 80 20 62C20 46 30 20 50 20Z',ey:52},
};
const PX={};
function cnv(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
function rgb(h){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]}
function shadeHex(h,f){const c=rgb(h).map(v=>clamp(Math.round(f>1?v+(255-v)*(f-1):v*f),0,255));return '#'+c.map(v=>v.toString(16).padStart(2,'0')).join('')}
function lum(h){const [r,g,b]=rgb(h);return (0.299*r+0.587*g+0.114*b)/255}
/* grid buffer helpers */
function Grid(w,h){return {w,h,a:new Array(w*h).fill(null)}}
function gset(G,x,y,c){if(x>=0&&y>=0&&x<G.w&&y<G.h)G.a[y*G.w+x]=c}
function gget(G,x,y){return (x>=0&&y>=0&&x<G.w&&y<G.h)?G.a[y*G.w+x]:null}
function gputIcon(G,key,x,y){const ic=ICONS[key];if(!ic)return;ic.forEach((row,j)=>{for(let i=0;i<row.length;i++){const ch=row[i];if(ch!=='.')gset(G,x+i,y+j,ICPAL[ch])}})}
function gToCanvas(G,scale=1){const c=cnv(G.w*scale,G.h*scale),x=c.getContext('2d');const id=x.createImageData(G.w,G.h);
 for(let i=0;i<G.a.length;i++){const v=G.a[i];if(!v)continue;const [r,g,b]=rgb(v);id.data[i*4]=r;id.data[i*4+1]=g;id.data[i*4+2]=b;id.data[i*4+3]=255}
 if(scale===1){x.putImageData(id,0,0);return c}const t=cnv(G.w,G.h);t.getContext('2d').putImageData(id,0,0);x.imageSmoothingEnabled=false;x.drawImage(t,0,0,G.w*scale,G.h*scale);return c}
function outlineGrid(G,col,dark){const add=[];for(let y=0;y<G.h;y++)for(let x=0;x<G.w;x++){if(G.a[y*G.w+x])continue;
 if(gget(G,x-1,y)||gget(G,x+1,y)||gget(G,x,y-1)||gget(G,x,y+1))add.push([x,y])}add.forEach(([x,y])=>gset(G,x,y,col))}
function iconW(key){return Math.max(...ICONS[key].map(r=>r.length))}
function iconCanvas(key,scale=1){const k=key+'|'+scale;if(PX[k])return PX[k];const ic=ICONS[key];const G=Grid(iconW(key),ic.length);gputIcon(G,key,0,0);return PX[k]=gToCanvas(G,scale)}
function iconURL(key,scale=1){const k='u'+key+scale;return PX[k]||(PX[k]=iconCanvas(key,scale).toDataURL())}
function uiIco(key,size=22){const g=UIICO[key];let r='';g.forEach((row,j)=>{for(let i=0;i<row.length;i++)if(row[i]==='k')r+=`M${i} ${j}h1v1h-1z`});
 return `<svg viewBox="0 0 12 12" width="${size}" height="${size}" aria-hidden="true" shape-rendering="crispEdges"><path d="${r}" fill="currentColor"/></svg>`}

const BAYER=[0,2,3,1];
function tintOf(c,col){const k=c;const t=cnv(c.width,c.height),x=t.getContext('2d');x.drawImage(c,0,0);x.globalCompositeOperation='source-in';x.fillStyle=col;x.fillRect(0,0,c.width,c.height);return t}
function whiteOf(c){return c._w||(c._w=tintOf(c,'#FFFFFF'))}
function darkOf(c){return c._d||(c._d=tintOf(c,'#0E1418'))}
function sheetURL(frames,sil){const w=frames[0].width,h=frames[0].height,c=cnv(w*2,h),x=c.getContext('2d');frames.forEach((f,i)=>x.drawImage(sil?tintOf(f,'#000000'):f,i*w,0));return c.toDataURL()}

/* ---- humans: 32x44 battle sprite, 16x20 overworld ---- */
function humanGrid(d,view,frame){
 const G=Grid(32,44),R=(x,y,w,h,c)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)gset(G,i,j,c)};
 const sk=d.skin,sk2=shadeHex(sk,.85),dy=frame?1:0;
 if(d.shorts){R(10,30,12,4,d.bottom);R(11,34,4,6,sk);R(17,34,4,6,sk)}else{R(11,30,4,10,d.bottom);R(17,30,4,10,d.bottom)}
 R(10,40,6,3,d.shoe);R(16,40,6,3,d.shoe);
 const T=(x,y,w,h,c)=>R(x,y+dy,w,h-(y===18?dy:0),c);
 T(9,18,14,12,d.top);if(d.top2)T(19,18,4,12,d.top2);
 if(d.coat){T(13,18,6,12,'#8FB0C8');R(9,29,14,3,d.top)}
 const arm=d.tank?sk:d.top;T(6,19,3,9,arm);T(23,19,3,9,arm);T(6,28,3,2,sk);T(23,28,3,2,sk);
 if(!d.coat)R(9,29,14,1,shadeHex(d.bottom,.65));
 if(view==='front'){if(d.tie)T(15,18,2,7,d.tie);if(d.tag){T(18,20,4,2,'#F4C542');T(18,20,1,1,'#B9801C')}if(d.tank)T(13,18,6,2,sk)}
 const H=(x,y,w,h,c)=>R(x,y+dy,w,h,c);
 H(14,16,4,2,sk2);H(10,5,12,11,sk);H(11,4,10,1,sk);H(9,9,1,3,sk);H(22,9,1,3,sk);
 const hr=d.hair;
 if(view==='front'){H(13,10,1,2,'#1A1410');H(18,10,1,2,'#1A1410');H(15,13,2,1,'#B5584A');
  if(d.glasses){H(12,9,3,3,'#CFE8F5');H(17,9,3,3,'#CFE8F5');H(15,10,2,1,'#2A2A2A');H(13,10,1,1,'#1A1410');H(18,10,1,1,'#1A1410')}}
 const st=d.style;
 if(st==='beanie'){H(10,2,12,5,d.hat);H(9,5,14,2,d.hat2);H(15,1,2,1,d.hat2);H(10,7,12,1,hr);H(10,8,1,3,hr);H(21,8,1,3,hr);if(view==='back')H(10,7,12,8,hr)}
 if(st==='pony'){H(10,3,12,4,hr);H(9,5,1,9,hr);H(22,5,1,9,hr);H(11,7,4,1,hr);H(17,7,4,1,hr);H(10,5,12,1,d.hat);
  if(view==='front'){H(23,4,3,3,hr);H(24,7,3,6,hr);H(25,13,2,2,hr)}else{H(10,3,12,12,hr);H(10,5,12,1,d.hat);H(14,13,4,7,hr);H(15,20,2,2,hr)}}
 if(st==='spiky'){H(10,3,12,4,hr);[[10,2],[12,1],[13,2],[15,0],[16,1],[18,1],[19,2],[21,2],[11,2],[14,1],[17,1],[20,2]].forEach(([x,y])=>H(x,y,1,1,hr));
  if(view==='back')H(10,3,12,10,hr);if(d.headset){H(9,8,1,5,'#333');H(22,8,1,5,'#333');if(view==='front')H(19,13,3,1,'#333')}}
 if(st==='cowboy'){H(5,5,22,2,d.hat);H(10,1,12,4,d.hat);H(10,4,12,1,d.hat2);H(10,7,1,3,hr);H(21,7,1,3,hr);if(view==='front'&&d.stache)H(13,12,6,1,hr);if(view==='back')H(10,7,12,7,hr)}
 if(st==='bob'){H(9,3,14,5,hr);H(9,8,2,8,hr);H(21,8,2,8,hr);H(11,7,10,1,hr);if(view==='back')H(9,3,14,13,hr)}
 if(st==='bun'){H(13,0,6,3,hr);H(10,3,12,4,hr);H(9,6,1,5,hr);H(22,6,1,5,hr);if(view==='back')H(10,3,12,11,hr)}
 if(view==='back'){if(d.pack&&d.style==='beanie'){T(10,19,12,10,d.pack);T(12,23,8,3,shadeHex(d.pack,.78));T(10,18,2,2,shadeHex(d.pack,.7));T(20,18,2,2,shadeHex(d.pack,.7))}
  else if(d.pack){for(let i=0;i<11;i++)H(21-i,18+i,2,1,shadeHex(d.pack,.75));T(6,26,6,5,d.pack)}}
 // run shading
 for(let y=0;y<44;y++){let x=0;while(x<32){const c=gget(G,x,y);if(!c){x++;continue}let e=x;while(e+1<32&&gget(G,e+1,y)===c)e++;if(e-x>=3){gset(G,e,y,shadeHex(c,.78));gset(G,e-1,y,shadeHex(c,.86))}x=e+1}}
 outlineGrid(G,'#1A1410');return G}
function humanFrames(who,view){const k='h'+who+view;if(PX[k])return PX[k];return PX[k]=[0,1].map(f=>gToCanvas(humanGrid(PEOPLE[who],view,f)))}
function humanHTML(who,size,view='front'){const k='H'+who+view;const u=PX[k]||(PX[k]=sheetURL(humanFrames(who,view)));const h=Math.round(size*44/32);
 return `<span class="spr slow" style="width:${size}px;height:${h}px"><img src="${u}" alt=""></span>`}
function owGrid(d,dir,f){
 const G=Grid(16,20),R=(x,y,w,h,c)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)gset(G,i,j,c)};const sk=d.skin,hr=d.hair,b=f===1?1:0;
 if(dir==='side'){
  if(f===1){R(5,15,2,3,d.bottom);R(9,15,2,2,d.bottom);R(4,18,3,1,d.shoe);R(9,17,3,1,d.shoe)}else{R(6,15,2,3,d.bottom);R(8,15,2,3,d.bottom);R(6,18,4,1,d.shoe)}
  R(5,10,6,5,d.top);R(7,10+b,2,4,d.tank?sk:shadeHex(d.top,.8));R(7,14+b,2,1,sk);
  R(4,2,8,8,sk);R(4,9,1,1,null);
  if(d.style==='beanie'){R(4,1,8,3,d.hat);R(4,3,8,1,d.hat2);R(7,4,5,3,hr);R(10,4,2,5,hr)}
  else if(d.style==='pony'){R(4,1,8,3,hr);R(7,3,5,4,hr);R(10,3,2,6,hr);R(12,3,2,5,hr);R(4,2,8,1,d.hat)}
  else{R(4,1,8,3,hr);R(9,3,3,5,hr)}
  R(5,5,1,2,'#1A1410');if(d.pack)R(10,10,2,4,d.pack);
 } else {
  const l1=f===1?2:3,l2=f===2?2:3;R(5,15,2,l1,d.bottom);R(9,15,2,l2,d.bottom);R(4,15+l1,3,1,d.shoe);R(9,15+l2,3,1,d.shoe);
  R(4,10,8,5,d.top);const ar=d.tank?sk:d.top;R(3,10+(f===1?1:0),1,4,ar);R(12,10+(f===2?1:0),1,4,ar);
  R(3,14+(f===1?1:0),1,1,sk);R(12,14+(f===2?1:0),1,1,sk);
  R(4,2,8,8,sk);gset(G,4,2,null);gset(G,11,2,null);
  if(d.style==='beanie'){R(4,1,8,3,d.hat);R(4,3,8,1,d.hat2);R(4,4,8,1,hr);if(dir==='up')R(4,4,8,5,hr)}
  else if(d.style==='pony'){R(4,1,8,4,hr);R(3,3,1,5,hr);R(12,3,1,5,hr);R(4,2,8,1,d.hat);if(dir==='up'){R(4,1,8,8,hr);R(7,9,2,4,hr);R(4,2,8,1,d.hat)}}
  else{R(4,1,8,3,hr);if(dir==='up')R(4,1,8,7,hr)}
  if(dir==='down'){gset(G,6,6,'#1A1410');gset(G,9,6,'#1A1410')}
  if(dir==='up'&&d.pack){R(5,10,6,4,d.pack);R(6,11,4,1,shadeHex(d.pack,.75))}
 }
 outlineGrid(G,'#1A1410');return G}
function owFrames(who){const k='o'+who;if(PX[k])return PX[k];const d=PEOPLE[who],o={};['down','up','side'].forEach(dir=>o[dir]=[0,1,2].map(f=>gToCanvas(owGrid(d,dir,f))));
 o.sideR=o.side.map(c=>{const t=cnv(16,20),x=t.getContext('2d');x.translate(16,0);x.scale(-1,1);x.drawImage(c,0,0);return t});return PX[k]=o}

/* ---- coins ---- */
const COINR={penny:['#3E2306','#8A5B12','#C98A1B','#F2C14E','#FFE59A'],silver:['#252C33','#5F6B75','#9AA6B0','#D4DCE2','#FFFFFF'],gold:['#3A2405','#9C6A0C','#E2A72E','#FFD866','#FFF6C8'],tbtf:['#0E1230','#22347A','#4A5BC0','#8FA0F0','#DDE4FF']};
function coinCanvas(kind='penny',size=16){const k='c'+kind+size;if(PX[k])return PX[k];const R=COINR[kind]||COINR.penny,G=Grid(size,size),c=size/2,r=size/2-.2;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const dx=x+.5-c,dy=y+.5-c,d=Math.hypot(dx,dy);if(d>r)continue;let col;
  if(d>r-1.1)col=R[0];else if(d>r-(size>20?3.2:2.1))col=dx+dy<0?R[4]:R[1];
  else{let I=(-dx-dy)/(r*1.5);col=I>.45?R[4]:I>-.2?R[3]:R[2];
   if(size>20){const a=Math.atan2(dy,dx);if(d<r*.22)col=R[1];else if(d<r*.4&&Math.abs(Math.sin(a*6))>.82)col=R[1];else if(Math.abs(d-r*.62)<.55)col=R[2]}
   else if(d<2.1)col=R[1]}
  gset(G,x,y,col)}
 if(size>=32){const mark=['..kkkk..','.kkkkkk.','kk.k....','kk.k....','.kkkk...','...kkkk.','...k..kk','...k..kk','.kkkkkk.','..kkkk..'];const ox=Math.floor(size/2)-4,oy=Math.floor(size/2)-5;mark.forEach((row,j)=>{for(let i=0;i<row.length;i++)if(row[i]==='k')gset(G,ox+i,oy+j,R[1])});for(let j=-7;j<=6;j++)gset(G,Math.floor(size/2)-1,Math.floor(size/2)+j,R[1]);}
 return PX[k]=gToCanvas(G)}
function coinURL(kind,size=16){const k='C'+kind+size;return PX[k]||(PX[k]=coinCanvas(kind,size).toDataURL())}
function coinHTML(kind,css=32,size=16){return `<img class="pxi" src="${coinURL(kind,size)}" width="${css}" height="${css}" alt="">`}

/* ---- Seed Round eggs (20x24) ---- */
const EGGR={2:RAMP.Finance,5:RAMP.Dynasty,10:RAMP.Crypto};
function eggCanvas(tier,crack){const key='e'+tier+(crack?'c':'');if(PX[key])return PX[key];const G=Grid(40,48),R=EGGR[tier],inside=(x,y)=>{const dx=(x+.5-20)/17,dy=(y+.5-27)/(y<27?23:19);return dx*dx+dy*dy<=1};
 for(let y=0;y<48;y++)for(let x=0;x<40;x++){if(!inside(x,y))continue;const edge=!inside(x-1,y)||!inside(x+1,y)||!inside(x,y-1)||!inside(x,y+1);const dx=(x-20)/17,dy=(y-27)/23,t=-dx*.48-dy*.5+.5*Math.sqrt(Math.max(0,1-dx*dx-dy*dy));let col=edge?'#283044':t>.55?'#fff7df':t>.2?'#e8dfc8':t>-.2?'#c5c5b7':'#9aa9a3';
 if(!edge){const marks=tier===2?[[13,17,4],[28,25,5],[13,35,4]]:tier===5?[[16,13,4],[28,25,4],[12,31,5],[24,39,3]]:[[20,13,4],[10,26,4],[29,29,4],[19,40,3]];
 for(const [cx,cy,rad] of marks){const xx=x-cx,yy=y-cy,on=tier===10?Math.abs(xx)+Math.abs(yy)<rad*1.4:tier===5?yy>-rad&&yy<rad&&Math.abs(xx)<(yy+rad)*.7:xx*xx+yy*yy<rad*rad;if(on)col=xx+yy<0?R[4]:R[2]}
 if(y>28&&y<32&&tier===2)col=y===29?R[4]:R[2];}
 gset(G,x,y,col)}
 if(crack)for(let x=6;x<34;x++){const y=24+Math.round(Math.sin(x*.8)*2);gset(G,x,y,'#283044');gset(G,x,y+1,'#283044')}
 return PX[key]=gToCanvas(G)}
function eggHTML(tier,css=40,cls=''){const k='E'+tier;const u=PX[k]||(PX[k]=eggCanvas(tier).toDataURL());return `<img class="pxi ${cls}" src="${u}" width="${css}" height="${Math.round(css*1.2)}" alt="">`}
