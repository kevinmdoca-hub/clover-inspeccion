/* 0.9.4: code assets use an isolated, versioned cache; inspection/media stores are never touched. */
const BUILD='0.9.4-dev';
const SCOPE=new URL(self.registration.scope);
const CACHE='clover-inspection-dev-v094-'+SCOPE.pathname.replace(/[^a-z0-9]/gi,'_');
const ASSETS=['index.html','styles.css','app.js','manifest.webmanifest','icon-192.png','icon-512.png','brand-mark.png','shared-header.js','shared-header.css'];
const ASSET_SHA256={"index.html":"096bb6667799227cdcaaa42874c64884c55656b8868c16e0cd93af8f8c9f7e2a","styles.css":"7b0d0401f02b4583ababd98803489e3e903eaae13189c3433f183509937d831c","app.js":"1a6fc145ea06dc0ac4da543c1c5d917abb7983ae568f19f12ee6c100cc3608c7","manifest.webmanifest":"30f54d5edd76decf55286f1b02ffff5bbe5b77a61c41388cad8640d194c4b857","icon-192.png":"4deb3165297bafb38979aab0ed155f1d04265351cdec837f64a27a3e4c9cb82e","icon-512.png":"5941f4e9e52f541115528efe2ba7dd5862a7652c899c32caae108a6d81dec376","brand-mark.png":"8ef7b679b08699f39cf9b00329a097ec8aea0685eece5ff1f89d233e20c646df","shared-header.js":"3d7517f07f08134dbe74fbabf10ba5b6f4d1913a7d8ef6050b4578a88f1eccad","shared-header.css":"2f21fb61c29e3fc343f56d4a04cca695b0771b8f4983f3a9e97bb9c4a7b31a4c"};
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
