'use strict';
// Validate the files that an installed app will download, including pinned hashes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=process.env.GITHUB_REPOSITORY?.split('/')[1]||process.argv[2];
const base=path.resolve(['clover-service-pilot','clover-cost-pricing-pilot'].includes(repo)?'public':repo==='clover-routing-field-ops-pilot'?'dist':'.');
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');assert(html.includes('clover-settings.js?v=1.0.1'),'Settings import is stale');
if(repo!=='clover-market-intelligence'){
 const name=repo==='clover-location-visual-review'?'service-worker.js':'sw.js';
 const sw=fs.readFileSync(path.join(base,name),'utf8');
 const fixture=()=>({self:{registration:{scope:'https://fixture.test/'},location:{origin:'https://fixture.test'},addEventListener(){}},URL});
 const cache=vm.runInNewContext(sw+'\nCACHE;',fixture());assert(cache.includes('settings101'),'Worker cache is stale');
 const paths=vm.runInNewContext(sw+'\n(typeof ASSETS!=="undefined"?ASSETS:typeof SHELL!=="undefined"?SHELL:CORE);',fixture());
 for(const asset of paths){const url=new URL(asset,'https://fixture.test/');const file=path.join(base,decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname));assert(fs.existsSync(file),'Missing offline asset: '+asset);}
 if(repo==='clover-inspeccion'){
  const hashes=vm.runInNewContext(sw+'\nASSET_SHA256;',fixture());
  for(const [asset,expected]of Object.entries(hashes)){const file=path.join(base,asset.split('?')[0]);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),expected,'Offline asset hash: '+asset);}
 }
}
console.log('Settings 1.0.1 imports, worker assets and pinned offline integrity are consistent.');
