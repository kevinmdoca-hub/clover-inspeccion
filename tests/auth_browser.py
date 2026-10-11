from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
BOOT="async () => {\nconst {SessionGate,BrowserAuthStore,encode64}=await import('/shared-device/session-gate.mjs');\nconst {startAuthorizedInspections}=await import('/inspections-entry.mjs');\nconst pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);\nconst expected={sub:window.testUser||'test-user',device_id:'test-device',installation_id:'test-install',app:'inspections',workspace:'test-workspace',origin:location.origin,key_thumbprint:'test-thumb',scope_revision:'1'};\nlet now=Date.now(),mono=0;\nconst claims={...expected,iss:'clover-device-inspections-isolated-v1',policy:'clover-device-policy-1',iat:Math.floor(now/1000),exp:Math.floor(now/1000)+3*86400,code_epoch:1,timezone:'America/Mexico_City'};\nconst part=v=>encode64(new TextEncoder().encode(JSON.stringify(v)));\nconst payload=part({alg:'EdDSA',kid:'test',typ:'clover-offline-receipt'})+'.'+part(claims);\nconst token=payload+'.'+encode64(new Uint8Array(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(payload))));\nconst keys={test:encode64(new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey)))};\nconst store=new BrowserAuthStore(localStorage,'clover:shared-auth:v1:inspections-browser-test:'+crypto.randomUUID());store.installOnlineReceipt(token);\nconst gate=new SessionGate({keys,expected,store,clock:()=>now,monotonic:()=>mono,verifyCode:async c=>c==='12345678'});\nwindow.testGate=gate;window.advance=ms=>{now+=ms;mono+=ms;};\nif(window.deferStartup)return;\nif(!await gate.unlock('12345678'))throw Error(gate.reason);\nawait startAuthorizedInspections(gate);\n}"
try:
 with sync_playwright() as p:
  browser=p.chromium.launch();context=browser.new_context(service_workers='block')
  context.route('**/*',lambda route:route.continue_() if urlsplit(route.request.url).netloc==urlsplit(base).netloc else route.abort())
  page=context.new_page();requests=[];page.on('request',lambda req:requests.append(req.url))
  page.add_init_script("localStorage.setItem('clover-inspection-dev-v090-state','legacy-unowned')")
  page.goto(base)
  assert page.locator('#inspections-operational').is_hidden()
  assert not any(urlsplit(url).path=='/app.js' for url in requests)
  assert page.evaluate("localStorage.getItem('clover-inspection-dev-v090-state')")=='legacy-unowned'
  print('PASS mandatory startup hides every operational screen and preserves legacy buffer',flush=True)
  page.evaluate(BOOT)
  assert page.locator('#inspections-operational').is_visible()
  assert page.locator('#workspaceView').is_visible()
  assert page.evaluate("localStorage.getItem('clover-inspection-dev-v090-state')")=='legacy-unowned'
  assert page.evaluate("indexedDB.databases().then(xs=>xs.some(x=>x.name.startsWith('clover.inspections.account.v1:')))")
  assert page.evaluate("indexedDB.databases().then(xs=>!xs.some(x=>x.name==='clover-inspection-dev-v090'))")
  print('PASS authorized app starts with account database and does not open legacy database',flush=True)
  result=page.evaluate("""async()=>{
    const {inspectionsAccess}=await import('/inspections-entry.mjs');const access=inspectionsAccess();
    access.storage.setItem('retained-draft','saved');
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(access.databaseName);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const tx=access.transaction(db,['state'],'readwrite');tx.objectStore('state').put({key:'must-abort',raw:'blocked'});
    const finished=new Promise(resolve=>{tx.addEventListener('abort',()=>resolve('aborted'));tx.addEventListener('complete',()=>resolve('committed'));});
    advance(15*60*1000);testGate.check();return await finished;
  }""")
  assert result=='aborted'
  assert page.locator('#inspections-operational').is_hidden()
  assert page.evaluate("Object.entries(localStorage).some(([k,v])=>k.includes('retained-draft')&&v==='saved')")
  assert page.evaluate("import('/inspections-entry.mjs').then(({inspectionsAccess})=>{try{inspectionsAccess();return false;}catch{return true;}})")
  print('PASS idle lock aborts active transaction, rejects access and keeps committed drafts',flush=True)
  assert page.evaluate("testGate.unlock('12345678')")
  assert page.locator('#inspections-operational').is_hidden()
  print('PASS revoked document cannot reopen until reload',flush=True)
  second=context.new_page();second.goto(base);second.evaluate("window.testUser='second-account'");second.evaluate(BOOT)
  assert second.locator('#workspaceView').is_visible()
  assert second.evaluate("indexedDB.databases().then(xs=>xs.filter(x=>x.name.startsWith('clover.inspections.account.v1:')).length)")==2
  print('PASS separate accounts receive separate inspection databases',flush=True)
  context.close();browser.close()
 print('PASS 5 Inspections browser cases')
finally:server.shutdown()
