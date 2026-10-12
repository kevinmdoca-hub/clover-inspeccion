import {GateError,encode64,decode64} from './session-gate.mjs';
// Python canonical() compatibility for the ASCII challenge envelope fields.
const canonical=value=>JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])));
export class DeviceServiceClient {
  constructor({post,token,app,workspace,origin,installationId,privateKey,publicKey,crypto=globalThis.crypto,clock=()=>Date.now()}){
    Object.assign(this,{post,token,app,workspace,origin,installationId,privateKey,publicKey,crypto,clock});
  }
  async command(operation,payload,requestId=this.crypto.randomUUID()){
    const accessToken=await this.token();
    if(typeof accessToken!=='string'||!accessToken)throw new GateError('sign_in_required');
    const request={app:this.app,workspace:this.workspace,origin:this.origin,operation,payload,request_id:requestId};
    const c=await this.post('challenge',request,accessToken);
    if(!c||Object.keys(c).sort().join(',')!=='challenge_id,expires_at,issued_at,public_key,request_hash'||c.public_key!==this.publicKey||
      !/^[a-f0-9]{32}$/.test(c.challenge_id)||!/^[a-f0-9]{64}$/.test(c.request_hash)||
      !Number.isSafeInteger(c.issued_at)||!Number.isSafeInteger(c.expires_at)||c.expires_at-c.issued_at!==120||
      this.clock()/1000<c.issued_at||this.clock()/1000>=c.expires_at)throw new GateError('invalid_challenge');
    const signature=encode64(new Uint8Array(await this.crypto.subtle.sign('Ed25519',this.privateKey,new TextEncoder().encode(canonical(c)))));
    return this.post('execute',{...request,challenge_id:c.challenge_id,signature},accessToken);
  }
  async verifyAndAuthorize(code){
    if(typeof code!=='string'||!/^[0-9]{8}$/.test(code))throw new GateError('code_format');
    const verified=await this.command('verify_code',{installation_id:this.installationId,code});
    if(verified?.verified!==true||!Number.isSafeInteger(verified.code_epoch))throw new GateError('code_rejected');
    const authorized=await this.command('authorize',{installation_id:this.installationId});
    return {...authorized,verificationEpoch:verified.code_epoch};
  }
}

// Endpoint contract for the still-unprovisioned server HTTP boundary.
export function httpsTransport(endpoint,fetcher=globalThis.fetch){
  const url=new URL(endpoint);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('Fixed HTTPS endpoint required');
  return async(action,body,token)=>{
    if(!['challenge','execute','identity'].includes(action))throw new GateError('invalid_action');
    let response;
    try{response=await fetcher(url.href.replace(/\/$/,'')+'/'+action,{method:'POST',redirect:'error',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(body)});}
    catch{throw new GateError('service_unavailable');}
    if(!response.ok)throw new GateError(response.status===428?'reauth_required':response.status===429?'too_many_attempts':[401,403].includes(response.status)?'online_authorization_denied':'service_request_failed');
    const text=await response.text();if(text.length>32768)throw new GateError('invalid_service_response');
    try{return JSON.parse(text);}catch{throw new GateError('invalid_service_response');}
  };
}
