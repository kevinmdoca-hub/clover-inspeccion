import {SessionGate,BrowserAuthStore,verifyReceipt,decode64,GateError} from './session-gate.mjs';
import {EnrollmentVault,EnrollmentController} from './enrollment.mjs';
import {SharedDeviceAdapter,AttemptDatabase,AttemptLimiter} from './device-adapter.mjs';
import {DeviceServiceClient,httpsTransport} from './service-client.mjs';
export const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v).replace(/[^\x00-\x7F]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
export async function digest(value,crypto=globalThis.crypto){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',value))].map(x=>x.toString(16).padStart(2,'0')).join('');}
const fail=message=>{throw new GateError(message);};
export async function validateContext(value,{userId,app,workspace,crypto=globalThis.crypto}){
  if(!value||value.user_id!==userId||!value.scope||value.scope.app!==app||value.scope.workspace!==workspace||value.scope.policy!=='clover-existing-access-v1'||
    typeof value.scope_revision!=='string'||await digest(new TextEncoder().encode(canonical(value.scope)),crypto)!==value.scope_revision)fail('identity_context_invalid');
  if(app==='rental'&&(!Array.isArray(value.scope.capabilities)||value.scope.capabilities.some(c=>typeof c!=='string')))fail('identity_context_invalid');
  if(app==='costs'&&typeof value.scope.workspace_role!=='string')fail('identity_context_invalid');
  if(app==='inspections'&&value.scope.inspections_access!=='member')fail('identity_context_invalid');
  if(app==='service'&&value.scope.service_access!=='member')fail('identity_context_invalid');
  return structuredClone(value);
}

// Builds detached components only. No DOM/global publication or business data access.
export async function buildRuntime({userId,app,workspace,origin,endpoint,keys,timezone,getSession,getAccessToken,
  signal,storage=globalThis.localStorage,indexedDB=globalThis.indexedDB,crypto=globalThis.crypto,
  online=()=>navigator.onLine!==false,clock=()=>Date.now(),post=httpsTransport(endpoint)}){
  if(!userId||!['rental','costs','service','inspections'].includes(app)||!workspace||new URL(origin).origin!==origin||!keys||!Object.keys(keys).length)fail('runtime_configuration_required');
  if(typeof timezone!=='string'||!timezone)fail('policy_timezone_required');
  try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{fail('policy_timezone_required');}
  const scope=JSON.stringify([origin,app,workspace,userId]);
  const namespace='clover:shared-auth:v1:'+await digest(new TextEncoder().encode(scope),crypto)+':';
  const store=new BrowserAuthStore(storage,namespace),vault=new EnrollmentVault(indexedDB);
  const current=()=>{if(signal?.aborted||getSession()?.user?.id!==userId)fail('account_changed');};
  const token=async()=>{current();const value=getAccessToken?await getAccessToken():getSession()?.access_token;current();if(!value)fail('sign_in_required');return value;};
  current();
  const contextKey=namespace+'scope-snapshot';
  let context;
  if(online()){
    try{context=await post('identity',{app,workspace,origin},await token());}
    catch(error){if(error.message==='online_authorization_denied'){try{store.signOut();}catch{}}throw error;}
  }else{
    try{context=JSON.parse(storage.getItem(contextKey));}catch{fail('online_required');}
  }
  current();context=await validateContext(context,{userId,app,workspace,crypto});current();
  const record=online()?await vault.obtain(scope,crypto):await vault.read(scope);current();
  if(!record)fail('online_required');
  const expected={sub:userId,device_id:record.deviceId||'not-enrolled',installation_id:record.installationId,
    app,workspace,origin,key_thumbprint:await digest(decode64(record.publicKey),crypto),scope_revision:context.scope_revision};
  const saved=store.peek();
  if(!online()){
    if(!saved||saved.signedOut||!record.deviceId)fail('online_required');
    await verifyReceipt(saved.receipt,{keys,expected,now:clock(),highWater:saved.highWater,minimumEpoch:Math.max(record.epoch,saved.minimumEpoch),crypto});
  }
  current();
  // Snapshot alone grants nothing; offline use requires the exact signed receipt hash.
  if(online())storage.setItem(contextKey,JSON.stringify(context));
  const gate=new SessionGate({keys,expected,store,clock});
  const clientFactory=rec=>new DeviceServiceClient({post,token,app,workspace,origin,installationId:rec.installationId,privateKey:rec.privateKey,publicKey:rec.publicKey,crypto,clock});
  const adapter=new SharedDeviceAdapter({gate,store,clock,crypto,
    limiter:new AttemptLimiter(new AttemptDatabase(indexedDB),scope,{clock,crypto}),service:clientFactory(record)});
  const hasCredential=adapter.configured.bind(adapter);
  adapter.configured=()=>!!record.deviceId||hasCredential();
  const controller=new EnrollmentController({vault,scope,clientFactory,keys,store,clock,crypto,online,
    identity:{userId,app,workspace,origin,timezone,scopeRevision:context.scope_revision},lock:reason=>gate.lock(reason),
    activate:()=>fail('runtime_not_published'),reauthenticate:async()=>{
      const fresh=await validateContext(await post('identity',{app,workspace,origin},await token()),{userId,app,workspace,crypto});current();
      if(fresh.scope_revision!==context.scope_revision)fail('permissions_changed_reload');
      if(!Number.isSafeInteger(fresh.reauth_at)||clock()/1000-fresh.reauth_at<0||clock()/1000-fresh.reauth_at>300)fail('reauth_required');
    }});
  current();return {userId,gate,adapter,controller,scopeSnapshot:context.scope,store,context};
}
