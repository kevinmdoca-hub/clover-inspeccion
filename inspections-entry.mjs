import {SessionGate,bindDocument} from './shared-device/session-gate.mjs';

let active=null;
const regions=()=>[...document.querySelectorAll('[data-clover-operational]')];
const hide=()=>{document.documentElement.removeAttribute('data-inspections-ready');for(const el of regions()){el.hidden=true;el.inert=true;if(el.tagName==='DIALOG'&&el.open)el.close();}for(const el of document.querySelectorAll('dialog[open]'))el.close();};
hide();
export function inspectionsAccess(){if(!active)throw Error('INSPECTIONS_SIGN_IN_REQUIRED');active.assert();return active;}

// Called by the Inspections account provider ONLY after server authorization
// and receipt/code verification. No test identity or fallback login is shipped.
export async function startAuthorizedInspections(gate){
  if(!(gate instanceof SessionGate))throw Error('INSPECTIONS_SESSION_GATE_REQUIRED');
  gate.assertOperational();
  if(gate.claims?.app!=='inspections'||gate.claims.origin!==location.origin)throw Error('INSPECTIONS_SCOPE_REQUIRED');
  if(active)throw Error('INSPECTIONS_ACCOUNT_CHANGE_REQUIRES_RELOAD');
  if(!navigator.locks)throw Error('INSPECTIONS_WRITER_LOCK_REQUIRED');
  const identity=claims=>JSON.stringify(['sub','device_id','installation_id','app','workspace','origin','key_thumbprint','scope_revision','code_epoch'].map(k=>claims[k]));
  const binding=identity(gate.claims),owner=gate.claims.sub,workspace=gate.claims.workspace;
  const lockName='clover-inspections-writer:'+JSON.stringify([workspace,owner]);
  let release,held=false;
  await new Promise((resolve,reject)=>{
    navigator.locks.request(lockName,{ifAvailable:true},async lock=>{
      if(!lock){reject(Error('INSPECTIONS_ALREADY_OPEN'));return;}
      held=true;resolve();await new Promise(done=>{release=done;});held=false;
    }).catch(reject);
  });
  const assert=()=>{if(revoked)throw Error('INSPECTIONS_RELOAD_REQUIRED');gate.assertOperational();if(!held||identity(gate.claims)!==binding)throw Error('INSPECTIONS_AUTHORIZATION_CHANGED');};
  const allowed=()=>{try{assert();return true;}catch{hide();return false;}};
  const transactions=new Set();
  const originalHidden=new Map(regions().map(el=>[el,el.id==='restore-file']));
  let loaded=false,revoked=false;
  const region={contains:el=>regions().some(root=>root.contains(el)),set hidden(value){for(const el of regions())el.hidden=value||!loaded||originalHidden.get(el);},set inert(value){for(const el of regions())el.inert=value;}};
  const lockScreen=document.querySelector('#inspections-entry');
  const previous=gate.onChange;
  gate.onChange=status=>{previous(status);if(status.state==='locked'){revoked=true;for(const tx of transactions){try{tx.abort();}catch{}}hide();}else if(loaded&&allowed())document.documentElement.setAttribute('data-inspections-ready','true');};
  const detach=bindDocument(gate,{root:region,lockScreen});
  const events=['input','change','clover-menu','clover-home','clover-create','clover-sync','clover-settings'];
  const guard=event=>{if(region.contains(event.target)&&!allowed()){event.preventDefault();event.stopImmediatePropagation();}};
  for(const event of events)document.addEventListener(event,guard,true);
  const prefix='clover.inspections.account.v1:'+JSON.stringify([location.origin,workspace,owner])+':';
  const storage=Object.freeze({getItem(key){assert();return localStorage.getItem(prefix+key);},setItem(key,value){assert();localStorage.setItem(prefix+key,value);},removeItem(key){assert();localStorage.removeItem(prefix+key);}});
  active=Object.freeze({assert,allowed,storage,databaseName:prefix+'database',transaction(db,stores,mode){assert();const tx=db.transaction(stores,mode);transactions.add(tx);const done=()=>transactions.delete(tx);tx.addEventListener('complete',done);tx.addEventListener('abort',done);return tx;},capture(){assert();const generation=gate.generation;return()=>{assert();if(gate.generation!==generation)throw Error('INSPECTIONS_STALE_OPERATION');};}});
  window.addEventListener('pagehide',()=>{hide();release?.();},{once:true});
  try{
    assert();await import('./header-adapter.js');assert();await import('./app.js');await window.CloverInspectionReady;assert();loaded=true;
    document.documentElement.setAttribute('data-inspections-ready','true');region.hidden=false;region.inert=false;lockScreen.hidden=true;
  }catch(error){hide();detach();release?.();throw error;}
}
