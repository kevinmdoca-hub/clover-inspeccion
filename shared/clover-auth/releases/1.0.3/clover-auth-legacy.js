/* Presentation bridge for existing Clover controllers. No persistence or network. */
(function(root){
  'use strict';
  const ui=root.CloverAuthUI;
  root.CloverEntryUI=ui; // Rental's existing controller retains its public CloverAuthUI name.
  const common=['forgot','verify','back','resend','usePassword','logout','cancel','requestNew'];
  const profiles={
    rental:[
      ['authEmail','login',{email:'authEmail',password:'authPassword',primary:'authSignIn',forgot:'authForgot',verify:'authVerify'}],
      ['verifyEmail','verify-email',{email:'verifyEmail',primary:'sendCode',back:'backLogin'}],
      ['otpCode','verify-code',{otp:'otpCode',primary:'verifyCode',resend:'resend'}],
      ['pwA','password-setup',{newPassword:'pwA',confirmPassword:'pwB',primary:'savePw'}],
      ['pinA','device-setup',{code:'pinA',confirmCode:'pinB',primary:'savePin'}],
      ['unlockPin','unlock',{code:'unlockPin',primary:'unlockBtn',usePassword:'usePassword',logout:'unlockLogout'}],
      ['recoverEmail','recovery-request',{email:'recoverEmail',primary:'sendRecovery',back:'backLogin'}]
    ],
    costs:[
      ['cm008-auth-email','login',{email:'cm008-auth-email',password:'cm008-auth-password',primary:'cm008-auth-signin',forgot:'cm008-auth-forgot',verify:'cm008-auth-first'}],
      ['cm008-verify-email','verify-email',{email:'cm008-verify-email',primary:'cm008-send-code',back:'cm008-back-login'}],
      ['cm008-otp','verify-code',{otp:'cm008-otp',primary:'cm008-verify-code',resend:'cm008-resend'}],
      ['cm008-pw-a','password-setup',{newPassword:'cm008-pw-a',confirmPassword:'cm008-pw-b',primary:'cm008-save-password'}],
      ['cm008-pin-a','device-setup',{code:'cm008-pin-a',confirmCode:'cm008-pin-b',primary:'cm008-save-pin'}],
      ['cm008-unlock-pin','unlock',{code:'cm008-unlock-pin',primary:'cm008-unlock',usePassword:'cm008-use-password',logout:'cm008-logout-lock'}],
      ['cm008-recovery-email','recovery-request',{email:'cm008-recovery-email',primary:'cm008-send-recovery',back:'cm008-back-login'}],
      ['cm008-back-login','recovery-sent',{back:'cm008-back-login'}]
    ]
  };
  root.CloverLegacyEntry=Object.freeze({
    mount(container,profile,body,options={}){
      const template=document.createElement('template');template.innerHTML=body;
      const old=template.content,find=id=>id?old.querySelector('#'+id):null;
      const match=profiles[profile].find(([id])=>find(id));
      const view=match?.[1]||'notice',ids={...(match?.[2]||{}),error:profile==='costs'?'cm008-auth-error':'authError'};
      const actions={};
      for(const key of common){const button=find(ids[key]);actions[key]={hidden:!button,...(button?{label:button.textContent}:{} )};}
      const primary=find(ids.primary)||(!match?old.querySelector('button'):null);
      if(!match&&primary){ids.primary=primary.id||'entryRetry';}
      if(profile==='costs'){ids.language='cm008-auth-language';actions.language={label:options.language==='en'?'Español':'English'};}
      const theme=document.documentElement.dataset.theme||'system';
      const message=!match?[...old.querySelectorAll('p')].map(p=>p.textContent).join('\n'):undefined;
      const shell=ui.mount(container,{view,theme,language:options.language,email:find(ids.email)?.value||options.email||'',name:old.querySelector('.authPerson b,.cm008-auth-user')?.textContent||'',ids,actions,
        ...(options.title?{title:options.title}:{}),...(!match?{message,title:options.title||old.querySelector('h1')?.textContent||''}:{}),...(primary?{primaryText:primary.textContent}:{}),
        notice:old.querySelector('.offlineText,.cm008-auth-offline')?.textContent||''});
      // Existing controllers retain validation, disabled state, click handlers and request lifetime.
      shell.refresh=()=>{};
      for(const [key,id] of Object.entries(ids)){
        const source=find(id),target=shell.querySelector('#'+id);
        if(!source||!target)continue;
        if(source.tagName==='INPUT'){
          for(const attr of ['required','minlength','maxlength','pattern','autocomplete','readonly']){
            if(source.hasAttribute(attr))target.setAttribute(attr,source.getAttribute(attr));else target.removeAttribute(attr);
          }
        }else if(target.tagName==='BUTTON'){target.type=source.type||'button';target.disabled=source.disabled;}
      }
      if(!options.email&&!find(ids.email))shell.querySelector('[data-field="email"]')?.closest('label').remove();
      if(primary&&!match)shell.primary.onclick=()=>location.reload();
      if(profile==='costs'){
        const show=shell.querySelector('[data-reveal="password"]');if(show)show.id='cm008-auth-show';
      }
      return shell;
    },
    unmount:ui.unmount
  });
})(window);
