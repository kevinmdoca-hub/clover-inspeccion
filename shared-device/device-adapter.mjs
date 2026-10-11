import {GateError,verifyReceipt,createLocalVerifier,checkLocalCode} from './session-gate.mjs';
const fail=reason=>{throw new GateError(reason);};
const binding=c=>JSON.stringify([c.sub,c.device_id,c.installation_id,c.app,c.workspace,c.origin,c.code_epoch]);

// One read-write IndexedDB transaction owns each update; competing tabs serialize.
export class AttemptDatabase {
  constructor(indexedDB=globalThis.indexedDB){this.indexedDB=indexedDB;}
  async open(){
    if(!this.indexedDB)fail('attempt_storage_unavailable');
    return new Promise((resolve,reject)=>{
      const r=this.indexedDB.open('clover-shared-auth-attempts-v1',1);
      r.onupgradeneeded=()=>r.result.createObjectStore('attempts');
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new GateError('attempt_storage_unavailable'));
      r.onblocked=()=>reject(new GateError('attempt_storage_unavailable'));
    });
  }
  async update(scope,change){
    const db=await this.open();
    try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction('attempts','readwrite'),store=tx.objectStore('attempts'),get=store.get(scope);
      let result,error;
      get.onsuccess=()=>{try{const next=change(get.result);result=next.result;store.put(next.state,scope);}catch(e){error=e;tx.abort();}};
      tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(error||new GateError('attempt_storage_unavailable'));tx.onerror=()=>{};
    });}finally{db.close();}
  }
}

export class AttemptLimiter {
  constructor(database,scope,{clock=()=>Date.now(),crypto=globalThis.crypto}={}){this.db=database;this.scope=scope;this.clock=clock;this.crypto=crypto;}
  async reserve(){
    const now=this.clock(),id=this.crypto.randomUUID();
    const result=await this.db.update(this.scope,old=>{
      const state=old||{highWater:0,attempts:[]};
      if(!Number.isFinite(now)||!Number.isFinite(state.highWater)||!Array.isArray(state.attempts))fail('attempt_storage_invalid');
      if(now<state.highWater)fail('clock_rollback');
      if(state.attempts.some(a=>typeof a.id!=='string'||!Number.isFinite(a.at)))fail('attempt_storage_invalid');
      state.highWater=now;state.attempts=state.attempts.filter(a=>now-a.at<300000);
      if(state.attempts.length>=5)return {state,result:null};
      state.attempts.push({id,at:now});return {state,result:id};
    });
    if(!result)fail('too_many_attempts');return result;
  }
  async complete(id,success){
    if(!success)return; // Failed/interrupted attempts remain for the five-minute window.
    await this.db.update(this.scope,state=>{if(!state)fail('attempt_storage_invalid');state.attempts=state.attempts.filter(a=>a.id!==id);return {state,result:true};});
  }
  async verify(check){const id=await this.reserve();const valid=await check();await this.complete(id,valid===true);return valid===true;}
}

export class SharedDeviceAdapter {
  constructor({gate,store,limiter,service,clock=()=>Date.now(),crypto=globalThis.crypto}){
    Object.assign(this,{gate,store,limiter,service,clock,crypto});this.generation=0;
    gate.verifyCode=(code,claims)=>limiter.verify(async()=>{
      const saved=store.read();return checkLocalCode(code,saved.credential,binding(claims),crypto);
    });
  }
  configured(){try{return !!this.store.read().credential;}catch{return false;}}
  assertOperational(){this.gate.assertOperational();}
  authorization(){this.gate.assertOperational();return this.gate.claims;}
  unlocked(){return this.gate.check();}
  async unlock(code,{online=true}={}){
    if(!online)return this.gate.unlock(code);
    const run=++this.generation;
    this.gate.lock('checking_online');
    // Service MUST execute block-3 challenge/proof-bound verify_code then authorize.
    // A transport success flag alone cannot install authorization.
    try{
      const {receipt,verificationEpoch}=await this.service.verifyAndAuthorize(code);
      const saved=this.store.read();
      const claims=await verifyReceipt(receipt,{keys:this.gate.keys,expected:this.gate.expected,now:this.clock(),highWater:saved.highWater,minimumEpoch:saved.minimumEpoch,crypto:this.crypto});
      if(!Number.isSafeInteger(verificationEpoch)||claims.code_epoch!==verificationEpoch)fail('code_changed_during_authorization');
      const credential=await createLocalVerifier(code,binding(claims),this.crypto);
      if(run!==this.generation)return false;
      // Atomic one-key write: never pair a new receipt with an old code verifier.
      this.store.installOnlineReceipt(receipt,credential);
      this.store.checkpoint({highWater:this.clock(),minimumEpoch:claims.code_epoch});
      return await this.gate.unlock(code);
    }catch(e){
      if(run===this.generation){
        if(e instanceof GateError && e.message==='online_authorization_denied'){
          // A known account/session denial must also block the prior offline lease.
          try{this.signOut();}catch{this.gate.lock('auth_state_unavailable');}
        }else this.gate.lock(e instanceof GateError?e.message:'online_authorization_failed');
      }
      return false;
    }
  }
  async setCode(code){
    // Enrollment/pairing/reset UI remains a separate explicit online ceremony.
    // Do not silently replace the existing cross-app code from an app-local form.
    fail('use_shared_device_enrollment');
  }
  signOut(){this.generation++;this.gate.signOut();}
}
