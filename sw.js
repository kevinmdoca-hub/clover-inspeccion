/* 0.9.5: code assets use an isolated, versioned cache; inspection/media stores are never touched. */
const BUILD='0.9.5-dev';
const SCOPE=new URL(self.registration.scope);
const CACHE='clover-inspection-dev-v095--ui111-8f5d1d28-header112-settings100'+SCOPE.pathname.replace(/[^a-z0-9]/gi,'_');
const ASSETS=["index.html","styles.css","app.js","manifest.webmanifest","icon-192.png","icon-512.png","brand-mark.png","header-adapter.js","header-integration.css","shared/clover-ui/clover-shell-header.js","shared/clover-ui/clover-shell-header.css","icons/clover-v111/icon-192.png","icons/clover-v111/icon-512.png","icons/clover-v111/apple-touch-icon-180.png","shared/clover-ui/clover-shell-header.js?v=1.1.2","shared/clover-ui/clover-shell-header.css?v=1.1.2","shared/clover-ui/clover-brand-mark-v1.png","shared/clover-settings/clover-settings.js?v=1.0.0","shared/clover-settings/clover-settings.css"];
const ASSET_SHA256={"index.html":"d0bf7e4b23017d065120a6322834e2c2cd61f31af7a2529fd531b89d2ef2e347","styles.css":"7b0d0401f02b4583ababd98803489e3e903eaae13189c3433f183509937d831c","app.js":"ff549f6de2227929e7dbad03f141f5496634f691b6e3e4867dfb7f8c24052674","manifest.webmanifest":"ddec7a91f00a81399c03bc44e1a710cd42b78817a203e4598a02f8ec1448d75f","icon-192.png":"4deb3165297bafb38979aab0ed155f1d04265351cdec837f64a27a3e4c9cb82e","icon-512.png":"5941f4e9e52f541115528efe2ba7dd5862a7652c899c32caae108a6d81dec376","brand-mark.png":"8ef7b679b08699f39cf9b00329a097ec8aea0685eece5ff1f89d233e20c646df","header-adapter.js":"1cecb55190d294fb1d2790b98c18bcc709d752509807bc69cb8ffa9a0c422a4d","header-integration.css":"eba38f5fdbb1fc6a55a186c16644abc11c43ba1ec3f83394c15dee1c0f1311a2","shared/clover-ui/clover-shell-header.js":"3d45770b85171429cbdc76f9533eb087f5cd73a87287768be9cca5e542cb6e87","shared/clover-ui/clover-shell-header.css":"b73a45c45cb4bab633668b5bd6be28876fe56fdeb48f4d475164bf9167a05a04","icons/clover-v111/icon-192.png":"7346b736832f933910009717905862cbed9fc5e6ac27f87bc799229e9eb89362","icons/clover-v111/icon-512.png":"ea82c55b7d80946621ee5e51449be26504060e6ffe20938bef21ee7e0d1f1e3b","icons/clover-v111/apple-touch-icon-180.png":"915e60d81c9d749de072f3de86e9bdf99f9c019d455d0d545a4922652850816d","shared/clover-ui/clover-shell-header.js?v=1.1.2":"3d45770b85171429cbdc76f9533eb087f5cd73a87287768be9cca5e542cb6e87","shared/clover-ui/clover-shell-header.css?v=1.1.2":"b73a45c45cb4bab633668b5bd6be28876fe56fdeb48f4d475164bf9167a05a04","shared/clover-ui/clover-brand-mark-v1.png":"5d7096e05bad83996c9c5ea2a56afc4d039b984b67cbb47ad3944dd458e2fc65","shared/clover-settings/clover-settings.js?v=1.0.0":"da0fb800b6a83516b5989c42bad25bae29fea74477027e5ad36e6d4a2558aff2","shared/clover-settings/clover-settings.css":"28fd7d2dbc58b41e7fca3b1429a889aca1aa33d756d54ce35859b58f22f4c3c9"};
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

