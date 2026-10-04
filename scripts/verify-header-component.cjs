/* Dependency-free exact-vendor boundary check. Does not open browser storage. */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p));
const text=p=>read(p).toString('utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);console.log('PASS '+msg)};
const expected='db4b8232c0ce1cfc993b4a77017428e110817292e91541b7ffee48ce533008fe';
assert(crypto.createHash('sha256').update(read('shared/clover-ui/clover-shell-header.js')).digest('hex')===expected,'canonical component bytes match supplied ZIP');
assert(JSON.parse(text('shared/clover-ui/manifest.json')).sha256===expected,'canonical manifest agrees');
const html=text('index.html'),adapter=text('header-adapter.js'),app=text('app.js'),css=text('header-integration.css');
assert(html.includes('type="module" src="./shared/clover-ui/clover-shell-header.js"'),'relative module import for GitHub Pages and offline cache');
assert((html.match(/<clover-shell-header\b/g)||[]).length===1,'exactly one shared component host');
assert(!html.includes('class="app-topbar')&&!fs.existsSync(path.join(root,'shared-header.js'))&&!fs.existsSync(path.join(root,'shared-header.css')),'former locally drawn header removed');
assert(!adapter.includes('shadowRoot')&&!adapter.includes('attachShadow')&&!css.includes('::part')&&!css.includes('#cloverHeader'),'no consumer Shadow DOM/appearance overrides');
for(const event of ['clover-menu','clover-home','clover-create','clover-sync','clover-settings'])assert(adapter.includes("addEventListener('"+event+"'"),'wired '+event);
for(const value of ["const DB_NAME='clover-inspection-dev-v090'","const STATE_KEY='clover-inspection-dev-v090-state'","const WORKSPACE_KEY='clover-inspection-dev-v090-current-job'","const DB_VERSION=4"])assert(app.includes(value),'preserved '+value);
const sw=text('sw.js');const hashes=JSON.parse(sw.match(/const ASSET_SHA256=(\{.*?\});/)[1]);
for(const [p,hash] of Object.entries(hashes))assert(crypto.createHash('sha256').update(read(p)).digest('hex')===hash,'cache asset integrity '+p);
assert(hashes['shared/clover-ui/clover-shell-header.js']===expected,'canonical nested module in offline precache');
