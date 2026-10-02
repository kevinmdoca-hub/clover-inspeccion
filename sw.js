/* 0.9.3: code assets use an isolated, versioned cache; inspection/media stores are never touched. */
const BUILD='0.9.3-dev';
const SCOPE=new URL(self.registration.scope);
const CACHE='clover-inspection-dev-v093-'+SCOPE.pathname.replace(/[^a-z0-9]/gi,'_');
const ASSETS=['index.html','styles.css','app.js','manifest.webmanifest','icon-192.png','icon-512.png','brand-mark.png'];
const ASSET_SHA256={"index.html":"990eb58f12d6d3534cb6e82f31e63db35c04e421b31224f64a0bbb321faa2e2d","styles.css":"7b0d0401f02b4583ababd98803489e3e903eaae13189c3433f183509937d831c","app.js":"639b62c83f979f682824e671ee8067099da5e824aa1512e08bd33c8840cd4ef2","manifest.webmanifest":"30f54d5edd76decf55286f1b02ffff5bbe5b77a61c41388cad8640d194c4b857","icon-192.png":"4deb3165297bafb38979aab0ed155f1d04265351cdec837f64a27a3e4c9cb82e","icon-512.png":"5941f4e9e52f541115528efe2ba7dd5862a7652c899c32caae108a6d81dec376","brand-mark.png":"8ef7b679b08699f39cf9b00329a097ec8aea0685eece5ff1f89d233e20c646df"};
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  for(const path of ASSETS){const url=new URL(path,SCOPE).href,response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('Incomplete application download');const bytes=await response.clone().arrayBuffer(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(digest!==ASSET_SHA256[path])throw new Error('Application file integrity mismatch');await cache.put(url,response)}
})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);if(url.origin!==SCOPE.origin||!url.pathname.startsWith(SCOPE.pathname))return;
  const name=url.pathname.slice(SCOPE.pathname.length)||'index.html';
  if(!ASSETS.includes(name)&&event.request.mode!=='navigate')return;
  const key=new URL(ASSETS.includes(name)?name:'index.html',SCOPE).href;
  event.respondWith((async()=>{const cache=await caches.open(CACHE),hit=await cache.match(key);if(hit)return hit;return fetch(event.request)})());
});
