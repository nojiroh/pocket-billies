/* Pocket Billies service worker: art and fonts come from the cache instantly and refresh in the background;
   code and game data always try the network first, so edits from Pocket Billies Studio show up on the next load. */
const V='pocketbillies-alpha-0.5';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>!k.startsWith(V)).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==location.origin)return;
 const art=/\/(art|fonts)\//.test(u.pathname)&&/\.(png|webp|svg|woff2|jpg)$/.test(u.pathname);
 if(art){e.respondWith(caches.open(V+'-art').then(async c=>{const hit=await c.match(r);const net=fetch(r).then(res=>{if(res.ok)c.put(r,res.clone());return res}).catch(()=>hit);return hit||net}));return}
 e.respondWith(fetch(r).then(res=>{if(res.ok){const cl=res.clone();caches.open(V+'-app').then(c=>c.put(r,cl))}return res}).catch(()=>caches.match(r)))});
