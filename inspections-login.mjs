import {attachSharedSettings} from './shared-device/settings-access.mjs';
import {buildRuntime} from './shared-device/runtime-builder.mjs';
import {enrollmentScreens,mountSharedScreen} from './shared-device/enrollment-screens.mjs';
import {startAuthorizedInspections,inspectionsAccess} from './inspections-entry.mjs';

// auth is the configured Supabase client's auth interface. Configuration must
// come from the reviewed deployment; this module does not invent app access.
export function installInspectionsLogin({auth,config,build=buildRuntime}){
  if(!auth?.signInWithPassword||!auth?.getSession||!auth?.onAuthStateChange||!auth?.signOut||!config?.endpoint||!config?.workspace||!config?.keys||!config?.timezone)throw Error('INSPECTIONS_LOGIN_CONFIGURATION_REQUIRED');
  const root=document.querySelector('#inspections-entry');
  if(!root||!window.CloverLegacyEntry)throw Error('INSPECTIONS_LOGIN_SHELL_REQUIRED');
  let detachSettings=()=>{},settingsMode=false;
  let session=null,runtime=null,revision=0,pending=null,started=false,disposed=false,inEnrollment=false;
  const language=()=>document.documentElement.lang.startsWith('es')?'es':'en';
  const t=(es,en)=>language()==='es'?es:en;
  const mount=(container,body,options={})=>{
    container.hidden=false;
    if(body.includes('id="authEmail"')){window.CloverLegacyEntry.mount(container,'rental',body,{...options,language:language()});return;}
    mountSharedScreen(container,body,{...options,language:language()});
  };
  const hide=()=>{document.documentElement.removeAttribute('data-inspections-ready');for(const el of document.querySelectorAll('[data-clover-operational]')){el.hidden=true;el.inert=true;}root.hidden=false;};
  function stop(){detachSettings();settingsMode=false;revision++;pending?.abort();pending=null;runtime?.controller.cancel();try{runtime?.adapter.signOut();}catch{runtime?.gate.lock('sign_in_required');}runtime=null;hide();}
  async function logout(){stop();session=null;try{await auth.signOut();}finally{login();}}
  function message(text){const el=root.querySelector('[role="alert"]');if(el)el.textContent=text;}
  function login(){
    if(disposed)return;
    if(started){mount(root,`<p>${t('Recarga para iniciar otra sesión. Tus borradores se conservan.','Reload to sign in again. Your drafts are preserved.')}</p><button id="inspectionsReload">${t('Recargar','Reload')}</button>`);root.querySelector('#inspectionsReload').onclick=()=>location.reload();return;}
    mount(root,`<label>${t('Correo','Email')}<input id="authEmail" type="email" autocomplete="username"></label><label>${t('Contraseña','Password')}<input id="authPassword" type="password" autocomplete="current-password"></label><button id="authSignIn">${t('Iniciar sesión','Sign in')}</button><p id="authError" role="alert"></p>`);
    root.querySelector('#authSignIn').onclick=async()=>{
      const generation=++revision,button=root.querySelector('#authSignIn'),password=root.querySelector('#authPassword');button.disabled=true;
      const credentials={email:root.querySelector('#authEmail').value.trim(),password:password.value};password.value='';
      try{const {data,error}=await auth.signInWithPassword(credentials);credentials.password='';if(error)throw error;if(generation!==revision||disposed)return;await accept(data.session);}
      catch{credentials.password='';if(generation===revision)message(t('No se pudo iniciar sesión. Revisa tu cuenta y acceso.','Could not sign in. Check your account and access.'));}
      finally{if(button.isConnected)button.disabled=false;}
    };
  }
  async function accept(next){
    if(disposed||!next?.user?.id)return;
    if(runtime&&session?.user?.id===next.user.id){session=next;return;}
    if(started){stop();session=null;login();return;}
    stop();session=next;const generation=revision,abort=new AbortController();pending=abort;
    try{
      const built=await build({...config,userId:next.user.id,app:'inspections',origin:location.origin,
        signal:abort.signal,getSession:()=>session,getAccessToken:async()=>{const {data,error}=await auth.getSession();if(error||data?.session?.user?.id!==session?.user?.id)throw Error('account_changed');session=data.session;return session.access_token;}});
      if(generation!==revision||disposed){built.controller.cancel();built.gate.lock('account_changed');return;}
      runtime=built;const {gate,adapter,controller}=built;
      const ready=async()=>{if(runtime!==built)throw Error('account_changed');gate.assertOperational();inEnrollment=false;if(settingsMode){location.reload();return;}if(!started){await startAuthorizedInspections(gate);started=true;}else inspectionsAccess();root.hidden=true;};
      controller.lock=reason=>gate.lock(reason);
      controller.activate=async({expected,code})=>{gate.expected=Object.freeze({...expected});if(!await gate.unlock(code))throw Error('unlock_failed');};
      const screens=enrollmentScreens({root,controller,mount,language,onReady:ready,onBack:()=>unlock(),onReauthenticate:logout});
      detachSettings=attachSharedSettings({window,assert:()=>gate.assertOperational(),identity:()=>({id:session.user.id,name:session.user.email||'Clover'}),open:()=>{settingsMode=true;inEnrollment=true;gate.lock('enrollment');hide();screens.reset();}});
      function unlock(){
        inEnrollment=false;
        mount(root,`<label>${t('Código compartido','Shared device code')}<input id="sharedUnlockCode" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></label><p id="authError" role="alert"></p><button id="sharedUnlock">${t('Desbloquear','Unlock')}</button><button id="sharedPair">${t('Vincular otra app','Pair another app')}</button><button id="sharedReset">${t('Cambiar código','Change code')}</button><button id="sharedLogout">${t('Cerrar sesión','Sign out')}</button>`);
        root.querySelector('#sharedUnlock').onclick=async()=>{const button=root.querySelector('#sharedUnlock'),field=root.querySelector('#sharedUnlockCode'),code=field.value;field.value='';button.disabled=true;try{if(!await adapter.unlock(code,{online:navigator.onLine!==false}))throw Error();await ready();}catch{message(t('No se pudo desbloquear. Revisa tu acceso; recarga si cambió tu código.','Could not unlock. Check access; reload if your code changed.'));}finally{if(button.isConnected)button.disabled=false;}};
        root.querySelector('#sharedPair').onclick=()=>{inEnrollment=true;screens.approve();};root.querySelector('#sharedReset').onclick=()=>{inEnrollment=true;screens.reset();};root.querySelector('#sharedLogout').onclick=logout;
      }
      const before=gate.onChange;gate.onChange=status=>{before(status);if(runtime!==built)return;if(status.state==='locked'){hide();if(started){login();return;}if(!inEnrollment&&!['checking','checking_online','enrollment','cancelled','sign_in_required'].includes(status.reason))unlock();}};
      if(adapter.configured())unlock();else{inEnrollment=true;screens.choose();}
    }catch{if(generation===revision&&!disposed){login();message(t('Acceso no disponible. Verifica tu conexión y membresía de Inspections.','Access unavailable. Check your connection and Inspections membership.'));}}
  }
  const {data:subscription}=auth.onAuthStateChange((event,next)=>{
    if(disposed)return;
    if(!next||session&&next.user?.id!==session.user.id){stop();session=null;queueMicrotask(login);}
    else if(session?.user?.id===next.user?.id)session=next;
    // Sign-in completion and initial restoration are owned by the calls below.
  });
  login();const initial=revision;
  void auth.getSession().then(({data,error})=>{if(!error&&!disposed&&revision===initial&&data?.session)void accept(data.session);}).catch(()=>{});
  return {dispose(){disposed=true;stop();subscription?.subscription?.unsubscribe();}};
}

if(window.CLOVER_INSPECTIONS_LOGIN){try{installInspectionsLogin(window.CLOVER_INSPECTIONS_LOGIN);}catch{/* Existing locked entry remains visible. */}}
