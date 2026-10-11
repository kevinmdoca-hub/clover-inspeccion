import {GateError,verifyReceipt,createLocalVerifier,encode64} from './session-gate.mjs';
const fail=reason=>{throw new GateError(reason);};
const checkCode=(code,confirm)=>{if(typeof code!=='string'||!/^[0-9]{8}$/.test(code)||code!==confirm)fail('codes_must_match');};
const localBinding=c=>JSON.stringify([c.sub,c.device_id,c.installation_id,c.app,c.workspace,c.origin,c.code_epoch]);

// Dedicated IndexedDB only. The private installation key is non-extractable.
export class EnrollmentVault {
  constructor(indexedDB=globalThis.indexedDB){this.indexedDB=indexedDB;}
  async transaction(scope,change){
    if(!this.indexedDB)fail('key_storage_unavailable');
    const db=await new Promise((resolve,reject)=>{
      const r=this.indexedDB.open('clover-shared-enrollment-v1',1);
      r.onupgradeneeded=()=>r.result.createObjectStore('installations');
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new GateError('key_storage_unavailable'));
    });
    try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction('installations','readwrite'),s=tx.objectStore('installations'),r=s.get(scope);let result,error;
      r.onsuccess=()=>{try{const next=change(r.result);result=next.result;if(next.state)s.put(next.state,scope);}catch(e){error=e;tx.abort();}};
      tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(error||new GateError('key_storage_unavailable'));tx.onerror=()=>{};
    });}finally{db.close();}
  }
  read(scope){return this.transaction(scope,state=>({state,result:state}));}
  async obtain(scope,crypto=globalThis.crypto){
    const existing=await this.read(scope);if(existing)return existing;
    const keys=await crypto.subtle.generateKey('Ed25519',false,['sign','verify']);
    const publicKey=encode64(new Uint8Array(await crypto.subtle.exportKey('raw',keys.publicKey)));
    const record={installationId:crypto.randomUUID(),privateKey:keys.privateKey,publicKey,deviceId:null,epoch:1,pending:null,pair:null};
    // Concurrent first launches keep the first committed installation/key pair.
    return this.transaction(scope,state=>({state:state||record,result:state||record}));
  }
}

export class EnrollmentController {
  constructor({vault,scope,clientFactory,identity,keys,store,lock,activate,reauthenticate,online=()=>navigator.onLine!==false,clock=()=>Date.now(),crypto=globalThis.crypto,onState=()=>{}}){
    Object.assign(this,{vault,scope,clientFactory,identity,keys,store,lock,activate,reauthenticate,online,clock,crypto,onState});this.generation=0;this.busy=false;
  }
  cancel(){this.generation++;this.lock('cancelled');this.onState('cancelled');}
  async run(operation,work){
    if(this.busy)fail('operation_in_progress');
    if(!this.online())fail('online_required');
    const generation=++this.generation;this.busy=true;this.lock('enrollment');this.onState('working');
    const current=()=>{if(generation!==this.generation)fail('cancelled');};
    try{
      // Must perform real account reauthentication; backend also enforces age.
      await this.reauthenticate();current();
      const record=await this.vault.obtain(this.scope,this.crypto);current();
      const client=this.clientFactory(record);
      const result=await work(record,client,current);current();this.onState('complete');return result;
    }catch(e){if(generation===this.generation)this.onState(e instanceof GateError?e.message:'enrollment_failed');throw e;}
    finally{this.busy=false;}
  }
  async intent(operation){
    return this.vault.transaction(this.scope,state=>{
      if(!state)fail('installation_missing');
      if(state.pending && state.pending.operation!==operation)fail('finish_pending_operation');
      state.pending ||= {operation,requestId:this.crypto.randomUUID()};
      return {state,result:state.pending.requestId};
    });
  }
  async saveResult(result){
    if(!result||!Number.isSafeInteger(result.code_epoch)||result.code_epoch<1||typeof result.device_id!=='string')fail('invalid_enrollment_result');
    return this.vault.transaction(this.scope,state=>{
      if(result.installation_id!==state.installationId)fail('wrong_installation');
      if(state.deviceId&&state.deviceId!==result.device_id)fail('wrong_device');
      state.deviceId=result.device_id;state.epoch=Math.max(state.epoch,result.code_epoch);state.pending=null;state.pair=null;
      return {state,result:state};
    });
  }
  async authorize(record,client,code,current){
    const verified=await client.verifyAndAuthorize(code);current();
    const thumb=Array.from(new Uint8Array(await this.crypto.subtle.digest('SHA-256',Uint8Array.from(atob(record.publicKey.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))))).map(n=>n.toString(16).padStart(2,'0')).join('');
    const expected={sub:this.identity.userId,device_id:record.deviceId,installation_id:record.installationId,app:this.identity.app,workspace:this.identity.workspace,origin:this.identity.origin,key_thumbprint:thumb,scope_revision:this.identity.scopeRevision};
    const saved=this.store.peek(); // Null is allowed only for first local enrollment.
    const claims=await verifyReceipt(verified.receipt,{keys:this.keys,expected,now:this.clock(),highWater:saved?.highWater||0,minimumEpoch:Math.max(record.epoch,saved?.minimumEpoch||1),crypto:this.crypto});current();
    if(verified.verificationEpoch!==claims.code_epoch)fail('code_changed_during_authorization');
    const credential=await createLocalVerifier(code,localBinding(claims),this.crypto);current();
    this.store.installOnlineReceipt(verified.receipt,credential);
    this.store.checkpoint({highWater:this.clock(),minimumEpoch:claims.code_epoch});
    current();await this.activate({record,expected,code});current();return true;
  }
  register(code,confirm,timezone){checkCode(code,confirm);new Intl.DateTimeFormat('en',{timeZone:timezone});return this.run('register',async(record,client,current)=>{
    if(!record.deviceId){const rid=await this.intent('register');const result=await client.command('register',{installation_id:record.installationId,public_key:record.publicKey,timezone,code},rid);current();record=await this.saveResult(result);}
    return this.authorize(record,client,code,current);
  });}
  beginPair(){return this.run('pair_begin',async(record,client,current)=>{
    if(record.deviceId)fail('already_enrolled');
    if(record.pair && this.clock()<record.pair.expires_at*1000)return record.pair;
    const rid=await this.intent('pair_begin'),pair=await client.command('pair_begin',{installation_id:record.installationId,public_key:record.publicKey},rid);current();
    if(!/^[a-f0-9]{32}$/.test(pair.pair_id)||!Number.isSafeInteger(pair.expires_at)||this.clock()>=pair.expires_at*1000)fail('invalid_pair');
    const shown={...pair,target_app:this.identity.app,target_installation_id:record.installationId};
    await this.vault.transaction(this.scope,state=>{state.pair=shown;state.pending=null;return {state,result:true};});return shown;
  });}
  approvePair(pair,confirmed){if(confirmed!==true)fail('confirmation_required');return this.run('pair_approve',async(record,client,current)=>{
    if(!record.deviceId)fail('enrollment_required');
    if(!pair||!/^[a-f0-9]{32}$/.test(pair.pair_id)||typeof pair.target_app!=='string'||typeof pair.target_installation_id!=='string')fail('invalid_pair');
    const rid=await this.intent('pair_approve'),result=await client.command('pair_approve',{installation_id:record.installationId,pair_id:pair.pair_id,target_app:pair.target_app,target_installation_id:pair.target_installation_id},rid);current();
    if(result.approved!==true||result.pair_id!==pair.pair_id)fail('pair_not_approved');
    await this.vault.transaction(this.scope,state=>{state.pending=null;return {state,result:true};});return true;
  });}
  consumePair(code){checkCode(code,code);return this.run('pair_consume',async(record,client,current)=>{
    if(record.deviceId)return this.authorize(record,client,code,current);
    if(!record.pair||this.clock()>=record.pair.expires_at*1000)fail('pair_expired');
    const rid=await this.intent('pair_consume'),result=await client.command('pair_consume',{pair_id:record.pair.pair_id,code},rid);current();
    record=await this.saveResult(result);return this.authorize(record,client,code,current);
  });}
  reset(code,confirm){checkCode(code,confirm);return this.run('reset_code',async(record,client,current)=>{
    if(!record.deviceId)fail('enrollment_required');
    // Invalidate the previous local lease before mutating the central code.
    // A receipt/storage failure after reset must not revive the old offline code.
    this.store.signOut();
    const rid=await this.intent('reset_code'),result=await client.command('reset_code',{installation_id:record.installationId,code},rid);current();
    if(!Number.isSafeInteger(result.code_epoch)||result.code_epoch<=record.epoch)fail('invalid_reset_epoch');
    record=await this.vault.transaction(this.scope,state=>{state.epoch=result.code_epoch;state.pending=null;return {state,result:state};});
    // Learn reset immediately, even if the follow-up receipt request fails.
    this.store.checkpoint({highWater:this.clock(),minimumEpoch:record.epoch});
    return this.authorize(record,client,code,current);
  });}
}
