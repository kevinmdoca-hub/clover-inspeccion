// The frozen legacy bridge only recognizes legacy field IDs. Shared-device
// screens use the approved shell directly and retain their own controls.
export function mountSharedScreen(root,body,{title='',language='es'}={},ui=globalThis.window.CloverEntryUI){
  root.hidden=false;
  const shell=ui.mount(root,{view:'notice',title,language,message:''});
  const card=shell.querySelector('.ca-card'),heading=card.querySelector('h1');
  const content=root.ownerDocument.createElement('div');content.innerHTML=body;
  for(const label of content.querySelectorAll('label'))label.classList.add('ca-field');
  for(const button of content.querySelectorAll('button')){
    button.type='button';
    button.classList.add(button.classList.contains('authLink')||/Back|Logout|SignOut|Reset|Pair|Approve$/.test(button.id)?'ca-link':'ca-primary');
  }
  for(const alert of content.querySelectorAll('[role="alert"]'))alert.classList.add('ca-message');
  card.replaceChildren(...(heading?[heading]:[]),content);
  shell.refresh=()=>{};
  return shell;
}

// Reuses the app's approved CloverLegacyEntry styling; no new brand/icon assets.
export function enrollmentScreens({root,controller,mount,language=()=> 'es',onReady=()=>{},onBack=()=>{},onReauthenticate}){
  const t=(es,en)=>language()==='es'?es:en;
  const $=id=>root.querySelector('#'+id);
  const card=(title,body)=>mount(root,body,{title,language:language()});
  const codeFields=()=>`<label class="authField">${t('Código de 8 dígitos','8-digit code')}<input id="sharedCode" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></label><label class="authField">${t('Confirmar código','Confirm code')}<input id="sharedConfirm" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></label>`;
  const footer=()=>`<p id="sharedError" role="alert"></p><button id="sharedReauthenticate" type="button" class="primaryBtn" hidden>${t('Iniciar sesión de nuevo','Sign in again')}</button><button id="sharedBack" type="button" class="authLink">${t('Volver','Back')}</button>`;
  const clearCodes=()=>{for(const id of ['sharedCode','sharedConfirm'])if($(id))$(id).value='';};
  const back=()=>{
    $('sharedBack').onclick=()=>{clearCodes();controller.cancel();onBack();};
    $('sharedReauthenticate').onclick=async()=>{
      const button=$('sharedReauthenticate');button.disabled=true;clearCodes();controller.cancel();
      try{if(typeof onReauthenticate!=='function')throw Error('unavailable');await onReauthenticate();}
      catch{if($('sharedError'))$('sharedError').textContent=t('No se pudo abrir el inicio de sesión. Vuelve a intentar.','Could not open sign-in. Please try again.');}
      finally{if(button.isConnected)button.disabled=false;}
    };
  };
  const act=(button,work)=>{button.onclick=async()=>{button.disabled=true;$('sharedError').textContent='';$('sharedReauthenticate').hidden=true;try{await work();}catch(error){
    // No server exception strings or account data are injected into markup.
    const reauth=['reauth_required','online_authorization_denied','sign_in_required'].includes(error?.message);
    if(reauth){clearCodes();if($('sharedReauthenticate'))$('sharedReauthenticate').hidden=false;}
    $('sharedError')&&($('sharedError').textContent=reauth?t('Por seguridad, inicia sesión de nuevo con tu cuenta de Clover y vuelve a intentar esta acción.','For security, sign in again with your Clover account, then retry this action.'):t('No se completó. Verifica tu conexión y acceso; vuelve a intentar con los mismos datos.','Not completed. Check your connection and access; retry with the same details.'));
  }finally{if(button.isConnected)button.disabled=false;}};};
  function choose(){card(t('Código compartido','Shared device code'),`<button id="sharedNew" class="primaryBtn">${t('Crear código para este dispositivo','Create a code for this device')}</button><button id="sharedPair" class="authLink">${t('Ya tengo un código en otra app de Clover','I already have a code in another Clover app')}</button>${footer()}`);$('sharedNew').onclick=register;$('sharedPair').onclick=pair;back();}
  function register(){card(t('Registrar dispositivo','Register device'),`${codeFields()}<label><input id="sharedNewConfirmed" type="checkbox">${t('Este dispositivo aún no tiene un código compartido de Clover.','This device does not yet have a shared Clover code.')}</label><button id="sharedSubmit" class="primaryBtn">${t('Registrar','Register')}</button>${footer()}`);act($('sharedSubmit'),async()=>{if(!$('sharedNewConfirmed').checked)throw Error('confirmation');await controller.register($('sharedCode').value,$('sharedConfirm').value,controller.identity.timezone);await onReady();});back();}
  function pair(){card(t('Vincular esta app','Pair this app'),`<p>${t('Inicia la solicitud y apruébala desde una app ya vinculada en este dispositivo.','Start the request and approve it from an app already paired on this device.')}</p><button id="sharedBegin" class="primaryBtn">${t('Iniciar solicitud','Start request')}</button><pre id="sharedInvitation"></pre><label class="authField">${t('Código compartido actual','Current shared code')}<input id="sharedCode" type="password" inputmode="numeric" maxlength="8"></label><button id="sharedConsume" class="primaryBtn" disabled>${t('Completar vinculación','Complete pairing')}</button>${footer()}`);act($('sharedBegin'),async()=>{const invitation=await controller.beginPair();$('sharedInvitation').textContent=JSON.stringify(invitation);$('sharedConsume').disabled=false;});act($('sharedConsume'),async()=>{await controller.consumePair($('sharedCode').value);await onReady();});back();}
  function approve(){card(t('Aprobar otra app','Approve another app'),`<label>${t('Solicitud de la otra app','Request from the other app')}<textarea id="sharedInvitationInput"></textarea></label><button id="sharedReview" class="primaryBtn">${t('Revisar','Review')}</button><pre id="sharedTarget"></pre><label><input id="sharedApproveConfirmed" type="checkbox">${t('Reconozco esta app y dispositivo.','I recognize this app and device.')}</label><button id="sharedApprove" class="primaryBtn" disabled>${t('Aprobar','Approve')}</button>${footer()}`);let reviewed=null;act($('sharedReview'),async()=>{const p=JSON.parse($('sharedInvitationInput').value);if(!p.target_app||!p.target_installation_id||!p.pair_id)throw Error('invalid');reviewed=p;$('sharedTarget').textContent=p.target_app+'\n'+p.target_installation_id;$('sharedApprove').disabled=false;});$('sharedInvitationInput').oninput=()=>{reviewed=null;$('sharedApprove').disabled=true;$('sharedApproveConfirmed').checked=false;};act($('sharedApprove'),async()=>{await controller.approvePair(reviewed,$('sharedApproveConfirmed').checked);onBack();});back();}
  function reset(){card(t('Cambiar código compartido','Change shared code'),`<p>${t('El nuevo código se usará en las apps vinculadas. Se requiere verificar tu cuenta en línea.','The new code will be used by paired apps. Online account verification is required.')}</p>${codeFields()}<button id="sharedSubmit" class="primaryBtn">${t('Cambiar código','Change code')}</button>${footer()}`);act($('sharedSubmit'),async()=>{await controller.reset($('sharedCode').value,$('sharedConfirm').value);await onReady();});back();}
  return {choose,register,pair,approve,reset};
}
