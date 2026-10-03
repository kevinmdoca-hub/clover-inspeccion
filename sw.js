/* 0.9.5: code assets use an isolated, versioned cache; inspection/media stores are never touched. */
const BUILD='0.9.5-dev';
const SCOPE=new URL(self.registration.scope);
const CACHE='clover-inspection-dev-v095-'+SCOPE.pathname.replace(/[^a-z0-9]/gi,'_');
const ASSETS=["index.html","styles.css","app.js","manifest.webmanifest","icon-192.png","icon-512.png","brand-mark.png","header-adapter.js","header-integration.css","shared/clover-ui/clover-shell-header.js"];
const ASSET_SHA256={"index.html":"606ec5947f74ce62b6d1ac1946f8da652814b803b79e8f009a52a72c17230ae8","styles.css":"7b0d0401f02b4583ababd98803489e3e903eaae13189c3433f183509937d831c","app.js":"543d9d37980144a5f2c0720e47a35b523a6f3aa421ae50e19602e1e069f28385","manifest.webmanifest":"30f54d5edd76decf55286f1b02ffff5bbe5b77a61c41388cad8640d194c4b857","icon-192.png":"4deb3165297bafb38979aab0ed155f1d04265351cdec837f64a27a3e4c9cb82e","icon-512.png":"5941f4e9e52f541115528efe2ba7dd5862a7652c899c32caae108a6d81dec376","brand-mark.png":"8ef7b679b08699f39cf9b00329a097ec8aea0685eece5ff1f89d233e20c646df","header-adapter.js":"1cecb55190d294fb1d2790b98c18bcc709d752509807bc69cb8ffa9a0c422a4d","header-integration.css":"eba38f5fdbb1fc6a55a186c16644abc11c43ba1ec3f83394c15dee1c0f1311a2","shared/clover-ui/clover-shell-header.js":"15f2cd0261c2363e61b34fbfc0c9a1c1132cb0d8998f7e132379e32abf24dcaa"};
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
