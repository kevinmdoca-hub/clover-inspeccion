// Browser session boundary. No business-data reads, writes, deletes or migration.
const encoder = new TextEncoder();
const FIELDS = ['sub','device_id','installation_id','app','workspace','origin','key_thumbprint','scope_revision'];
export const IDLE_MS = 15 * 60 * 1000;
export class GateError extends Error {}
const deny = reason => { throw new GateError(reason); };
export function decode64(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) deny('invalid_encoding');
  return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')), c=>c.charCodeAt(0));
}
export const encode64 = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export async function verifyReceipt(token, {keys, expected, now, highWater=0, minimumEpoch=1, crypto=globalThis.crypto}) {
  try {
    if (typeof token !== 'string' || token.length > 16384 || token.split('.').length !== 3) deny('invalid_receipt');
    const [h,p,s] = token.split('.');
    const header = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode64(h)));
    if (Object.keys(header).sort().join(',') !== 'alg,kid,typ' || header.alg !== 'EdDSA' || header.typ !== 'clover-offline-receipt' || !Object.hasOwn(keys,header.kid)) deny('untrusted_signer');
    const key = await crypto.subtle.importKey('raw',decode64(keys[header.kid]),'Ed25519',false,['verify']);
    if (!await crypto.subtle.verify('Ed25519',key,decode64(s),encoder.encode(h+'.'+p))) deny('bad_signature');
    const claims = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode64(p)));
    if (claims.iss !== 'clover-device-service-isolated-v1' || claims.policy !== 'clover-device-policy-1') deny('wrong_policy');
    if (Object.keys(expected).sort().join(',') !== [...FIELDS].sort().join(',') || FIELDS.some(k=>typeof expected[k] !== 'string' || !expected[k] || claims[k] !== expected[k])) deny('wrong_binding');
    if (![claims.iat,claims.exp,claims.code_epoch,minimumEpoch].every(Number.isSafeInteger) || claims.code_epoch < Math.max(1,minimumEpoch)) deny('wrong_epoch');
    if (!Number.isFinite(now) || !Number.isFinite(highWater) || now < highWater || now < claims.iat*1000) deny('clock_rollback');
    // Exact three-business-day expiry is calculated by the trusted signer.
    // This verifier consumes that signed absolute instant; no local renewal.
    if (claims.exp <= claims.iat || claims.exp-claims.iat > 7*86400 || now >= claims.exp*1000) deny('online_required');
    if (typeof claims.timezone !== 'string') deny('invalid_timezone');
    new Intl.DateTimeFormat('en',{timeZone:claims.timezone});
    return Object.freeze(claims);
  } catch (error) {
    if (error instanceof GateError) throw error;
    deny('receipt_or_crypto_unavailable');
  }
}

// App enrollment must create this only after the SERVER verifies the same code.
// Browser throttling cannot protect against a user who controls local storage.
export async function createLocalVerifier(code, binding, crypto=globalThis.crypto) {
  if (!/^[0-9]{8}$/.test(code) || typeof code !== 'string') deny('code_format');
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const record={version:1,iterations:600000,salt:encode64(salt),binding};
  record.digest=await derive(code,record,crypto);
  return record;
}
async function derive(code, record, crypto) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(code+'|'+record.binding),'PBKDF2',false,['deriveBits']);
  return encode64(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:600000,salt:decode64(record.salt)},key,256)));
}
export async function checkLocalCode(code,record,binding,crypto=globalThis.crypto) {
  if (typeof code !== 'string' || !/^[0-9]{8}$/.test(code) || !record || record.version!==1 || record.iterations!==600000 || record.binding!==binding || decode64(record.salt).length!==16) return false;
  const a=decode64(await derive(code,record,crypto)), b=decode64(record.digest);
  if (b.length!==32) return false;
  return a.reduce((d,v,i)=>d|(v^b[i]),0)===0;
}

export class SessionGate {
  constructor({keys,expected,store,verifyCode,clock=()=>Date.now(),monotonic=()=>performance.now(),onChange=()=>{}}) {
    this.keys=structuredClone(keys);this.expected=Object.freeze({...expected});
    this.store=store;this.verifyCode=verifyCode;this.clock=clock;this.monotonic=monotonic;this.onChange=onChange;
    this.state='locked';this.reason='sign_in_required';this.generation=0;this.claims=null;
    this.lastActivity=null;this.lastMono=null;this.highWater=0;this.minimumEpoch=1;
    this.notify();
  }
  notify(){this.onChange({state:this.state,reason:this.reason});}
  lock(reason='locked'){this.generation++;this.state='locked';this.reason=reason;this.notify();return false;}
  read(){
    const data=this.store.read();
    if (!data || !Number.isFinite(data.highWater) || !Number.isSafeInteger(data.minimumEpoch) || data.minimumEpoch<1) deny('auth_state_unavailable');
    this.highWater=Math.max(this.highWater,data.highWater);this.minimumEpoch=Math.max(this.minimumEpoch,data.minimumEpoch);
    return data;
  }
  checkpoint(now){
    this.highWater=Math.max(this.highWater,now);
    this.store.checkpoint({highWater:this.highWater,minimumEpoch:this.minimumEpoch});
  }
  async unlock(code) {
    const attempt=++this.generation;
    this.state='locked';this.reason='checking';this.notify();
    try {
      const saved=this.read();
      if (saved.signedOut) deny('sign_in_required');
      const token=saved.receipt;
      const claims=await verifyReceipt(token,{keys:this.keys,expected:this.expected,now:this.clock(),highWater:this.highWater,minimumEpoch:this.minimumEpoch});
      // Adapter must bind its verifier to this user/device/installation/epoch.
      if (!await this.verifyCode(code,claims)) deny('code_rejected');
      if (attempt!==this.generation) return false;
      const current=this.read();
      if (current.signedOut || current.receipt!==token || claims.code_epoch<this.minimumEpoch) deny('authorization_changed');
      const now=this.clock();
      if (now<this.highWater || now<claims.iat*1000 || now>=claims.exp*1000) deny('online_required');
      this.minimumEpoch=Math.max(this.minimumEpoch,claims.code_epoch);this.checkpoint(now);
      this.claims=claims;this.receipt=token;this.lastActivity=now;this.lastMono=this.monotonic();
      this.state='unlocked';this.reason='authorized';this.notify();return true;
    } catch(error) {
      if(attempt===this.generation)this.lock(error instanceof GateError?error.message:'auth_state_unavailable');
      return false;
    }
  }
  check() {
    if(this.state!=='unlocked')return false;
    try {
      const data=this.read(),now=this.clock(),mono=this.monotonic();
      if(data.signedOut || data.receipt!==this.receipt || this.claims.code_epoch<this.minimumEpoch)return this.lock('authorization_changed');
      if(now<this.highWater || now<this.lastActivity || mono<this.lastMono)return this.lock('clock_rollback');
      if(now>=this.claims.exp*1000)return this.lock('online_required');
      if(now-this.lastActivity>=IDLE_MS || mono-this.lastMono>=IDLE_MS)return this.lock('inactive');
      this.checkpoint(now);return true;
    }catch{return this.lock('auth_state_unavailable');}
  }
  activity(trusted) {
    if(!this.check())return false; // Never let the first late input reset the deadline.
    if(trusted===true){this.lastActivity=this.clock();this.lastMono=this.monotonic();}
    return true;
  }
  assertOperational(){if(!this.check())deny('locked');}
  signOut(){
    this.lock('sign_in_required');
    this.store.signOut(); // Auth namespace only; never localStorage.clear().
  }
}

// Every tab owns a separate monotonic checkpoint slot. Tabs never overwrite
// another tab's newer clock/epoch. No checkpoint pruning without online recovery.
export class BrowserAuthStore {
  constructor(storage, namespace, crypto=globalThis.crypto) {
    if(!namespace.startsWith('clover:shared-auth:v1:'))throw new Error('Auth namespace required');
    this.storage=storage;this.prefix=namespace+':';this.slot=this.prefix+'checkpoint:'+crypto.randomUUID();
  }
  read(){
    const raw=this.storage.getItem(this.prefix+'authorization');
    if(!raw)deny('sign_in_required');
    const data=JSON.parse(raw);
    let highWater=0,minimumEpoch=1,count=0;
    for(let i=0;i<this.storage.length;i++){
      const key=this.storage.key(i);
      if(!key?.startsWith(this.prefix+'checkpoint:'))continue;
      if(++count>128)deny('online_storage_maintenance_required');
      const point=JSON.parse(this.storage.getItem(key));
      if(!Number.isFinite(point.highWater)||!Number.isSafeInteger(point.minimumEpoch)||point.minimumEpoch<1)deny('auth_state_unavailable');
      highWater=Math.max(highWater,point.highWater);minimumEpoch=Math.max(minimumEpoch,point.minimumEpoch);
    }
    if(typeof data.receipt!=='string'||typeof data.signedOut!=='boolean')deny('auth_state_unavailable');
    return {...data,highWater,minimumEpoch};
  }
  peek(){return this.storage.getItem(this.prefix+'authorization')===null?null:this.read();}
  checkpoint(point){
    const previous=this.read();
    this.storage.setItem(this.slot,JSON.stringify({highWater:Math.max(previous.highWater,point.highWater),minimumEpoch:Math.max(previous.minimumEpoch,point.minimumEpoch)}));
  }
  signOut(){const data=this.read();this.storage.setItem(this.prefix+'authorization',JSON.stringify({receipt:data.receipt,signedOut:true}));}
  // The online adapter must verify fresh SERVER authorization and code before
  // calling this. It never changes clock/epoch checkpoints or business data.
  installOnlineReceipt(receipt,credential){this.storage.setItem(this.prefix+'authorization',JSON.stringify({receipt,signedOut:false,...(credential?{credential}:{})}));}
}

export function bindDocument(gate,{root,lockScreen,document=globalThis.document,window=globalThis.window}) {
  if(!root||!lockScreen)throw new Error('Operational root and lock screen required');
  const render=()=>{const open=gate.state==='unlocked';root.hidden=!open;root.inert=!open;lockScreen.hidden=open;};
  const prior=gate.onChange;gate.onChange=status=>{render();prior(status);};render();
  const guard=event=>{
    if(!root.contains(event.target))return;
    const activity=['pointerdown','keydown','touchstart','wheel'].includes(event.type);
    if(!(activity?gate.activity(event.isTrusted):gate.check())){event.preventDefault();event.stopImmediatePropagation();render();}
  };
  const events=['pointerdown','keydown','touchstart','wheel','click','submit','beforeinput'];
  for(const event of events)document.addEventListener(event,guard,{capture:true,passive:false});
  const recheck=()=>{gate.check();render();};
  const hide=()=>{gate.lock('page_hidden');root.hidden=true;root.inert=true;};
  const show=()=>{gate.lock('restored_page');render();};
  document.addEventListener('visibilitychange',recheck);
  window.addEventListener('focus',recheck);window.addEventListener('pagehide',hide);
  const changed=event=>{
    if(!event.key?.startsWith(gate.store.prefix))return;
    if(event.key===gate.store.prefix+'authorization'){gate.lock('auth_changed_elsewhere');render();return;}
    try{const data=gate.store.read();if(gate.claims && data.minimumEpoch>gate.claims.code_epoch)gate.lock('code_epoch_changed');}
    catch{gate.lock('auth_state_unavailable');}
    render(); // Do not write another checkpoint and create a cross-tab event loop.
  };
  window.addEventListener('pageshow',show);window.addEventListener('storage',changed);
  const timer=window.setInterval(recheck,1000);
  return ()=>{window.clearInterval(timer);for(const event of events)document.removeEventListener(event,guard,true);
    document.removeEventListener('visibilitychange',recheck);window.removeEventListener('focus',recheck);
    window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);window.removeEventListener('storage',changed);gate.lock('detached');};
}
