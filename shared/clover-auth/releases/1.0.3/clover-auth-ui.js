/* Clover Auth UI 1.0.3 — shared presentation, no storage/network/roles.
 * Light-DOM native forms are intentional: password managers see normal inputs.
 * Consumers supply state and wire actions. Presentation-only release; auth behavior is unchanged.
 */
(function (root) {
  'use strict';
  const VERSION = '1.0.3';
  const base = new URL('./', document.currentScript.src);
  const mark = new URL('clover-brand-mark-v1.png', base).href;
  let sequence = 0;
  let pageOwner = null;
  const escape = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const texts = {
    en: {email:'Email',password:'Clover password',show:'Show',hide:'Hide',signIn:'Sign In',forgot:'Forgot password?',verify:'First time / verify email',code:'Device code',unlock:'Unlock',usePassword:'Use email and password',logout:'Log out',back:'Back',sendCode:'Send code',verifyCode:'Verify',resendCode:'Send another code',newPassword:'New password',confirmPassword:'Confirm password',savePassword:'Save password',continue:'Continue',confirmCode:'Confirm code',saveCode:'Save code',sendLink:'Send recovery link',resendLink:'Request another link',requestNew:'Request a new link',done:'Done',retry:'Retry',pending:'Please wait…',loading:'Loading…',cancel:'Cancel',account:'Clover account'},
    es: {email:'Correo electrónico',password:'Contraseña de Clover',show:'Mostrar',hide:'Ocultar',signIn:'Iniciar sesión',forgot:'¿Olvidaste tu contraseña?',verify:'Primera vez / verificar correo',code:'Código del dispositivo',unlock:'Desbloquear',usePassword:'Usar correo y contraseña',logout:'Cerrar sesión',back:'Volver',sendCode:'Enviar código',verifyCode:'Verificar',resendCode:'Enviar otro código',newPassword:'Nueva contraseña',confirmPassword:'Confirmar contraseña',savePassword:'Guardar contraseña',continue:'Continuar',confirmCode:'Confirmar código',saveCode:'Guardar código',sendLink:'Enviar enlace de recuperación',resendLink:'Solicitar otro enlace',requestNew:'Solicitar un enlace nuevo',done:'Terminar',retry:'Reintentar',pending:'Espera un momento…',loading:'Cargando…',cancel:'Cancelar',account:'Cuenta de Clover'}
  };
  class CloverAuthShell extends HTMLElement {
    configure(model = {}) {
      this.model = model;
      this.language = model.language === 'en' ? 'en' : 'es';
      this.t = texts[this.language];
      this.uid = `clover-auth-${++sequence}`;
      this.pending = false;
      this.cooldowns = new Map();
      this.render();
      return this;
    }
    connectedCallback() {
      if (!this.model) this.configure({view:'loading'});
      this.startViewport();
      // Covers silent password-manager fills as well as input/change events.
      this.timer = root.setInterval(() => { if (!document.hidden) this.refresh(); }, 350);
      this.refresh();
    }
    disconnectedCallback() {
      this.stopViewport();
      root.clearInterval(this.timer);
      this.querySelectorAll('[data-secret]').forEach(input => { input.value = ''; });
      this.cooldowns?.clear();
    }
    startViewport() {
      // Mount/unmount is the only page-chrome lifetime; no session or data access.
      pageOwner?.stopViewport();
      pageOwner = this;
      const html = document.documentElement;
      this.pageSnapshot = {
        attribute:html.getAttribute('data-clover-auth-page'),
        mount:this.parentElement, mountAttribute:this.parentElement.getAttribute('data-clover-auth-mount'),
        scrollX:root.scrollX, scrollY:root.scrollY,
        metas:[...document.querySelectorAll('meta[name="theme-color"]')].map(el => [el,el.getAttribute('content')])
      };
      html.setAttribute('data-clover-auth-page',this.getAttribute('data-theme'));
      this.parentElement.setAttribute('data-clover-auth-mount','');
      const background = getComputedStyle(this).getPropertyValue('--ca-bg').trim();
      this.pageSnapshot.metas.forEach(([el]) => el.setAttribute('content',background));
      this.viewportEvents = new AbortController();
      const signal = this.viewportEvents.signal;
      const listen = (target,event,handler) => target?.addEventListener(event,handler,{signal,passive:true});
      listen(root.visualViewport,'resize',() => this.scheduleViewport(true));
      listen(root.visualViewport,'scroll',() => this.scheduleViewport(false));
      listen(root,'resize',() => this.scheduleViewport(true));
      listen(root,'orientationchange',() => this.scheduleViewport(true));
      listen(this,'focusin',() => {
        if (!this.hasAttribute('data-keyboard')) this.restScrollTop = this.scroller.scrollTop;
        this.scheduleViewport(true);
      });
      listen(this,'focusout',() => this.scheduleViewport(false));
      this.scroller = this.querySelector('.ca-viewport');
      this.updateViewport(false);
    }
    stopViewport() {
      this.viewportEvents?.abort();
      root.cancelAnimationFrame(this.viewportFrame);
      this.viewportFrame = 0;
      if (pageOwner !== this || !this.pageSnapshot) return;
      const saved = this.pageSnapshot, html = document.documentElement;
      if (saved.attribute === null) html.removeAttribute('data-clover-auth-page');
      else html.setAttribute('data-clover-auth-page',saved.attribute);
      if (saved.mountAttribute === null) saved.mount.removeAttribute('data-clover-auth-mount');
      else saved.mount.setAttribute('data-clover-auth-mount',saved.mountAttribute);
      saved.metas.forEach(([el,value]) => {
        if (value === null) el.removeAttribute('content'); else el.setAttribute('content',value);
      });
      pageOwner = null;
      this.pageSnapshot = null;
      root.scrollTo(saved.scrollX,saved.scrollY);
    }
    scheduleViewport(reveal) {
      this.revealFocus = this.revealFocus || reveal;
      if (this.viewportFrame) return;
      this.viewportFrame = root.requestAnimationFrame(() => {
        this.viewportFrame = 0;
        const shouldReveal = this.revealFocus;
        this.revealFocus = false;
        if (this.isConnected && pageOwner === this) this.updateViewport(shouldReveal);
      });
    }
    updateViewport(reveal) {
      const vv = root.visualViewport, html = document.documentElement;
      const layoutHeight = Math.max(html.clientHeight,root.innerHeight);
      const width = html.clientWidth;
      const active = document.activeElement;
      const focused = this.contains(active) && active.matches('input:not([readonly]):not(:disabled)');
      const zoomed = vv && Math.abs(vv.scale - 1) > .05;
      // Pinch zoom remains native: it is not a keyboard and must not reflow the brand.
      const height = !zoomed && vv?.height > 0 ? vv.height : layoutHeight;
      const top = !zoomed && vv ? Math.max(0,vv.offsetTop) : 0;
      const wasKeyboard = this.hasAttribute('data-keyboard');
      if (!this.restHeight || this.viewportWidth !== width) this.restHeight = layoutHeight;
      if (!focused && !wasKeyboard) this.restHeight = Math.max(layoutHeight,height);
      this.viewportWidth = width;
      // Focus can leave an input before the keyboard finishes closing (or while
      // Show/Hide is tapped). Keep the pane stable until the viewport expands.
      const keyboard = !zoomed && (focused || wasKeyboard) && Math.max(layoutHeight,this.restHeight) - height > 80;
      this.toggleAttribute('data-keyboard',keyboard);
      this.style.setProperty('--ca-viewport-top',top+'px');
      this.style.setProperty('--ca-viewport-height',height+'px');
      if (wasKeyboard && !keyboard) this.scroller.scrollTop = this.restScrollTop || 0;
      else if (reveal && focused && !zoomed) this.revealInput(active);
    }
    revealInput(input) {
      const pane = this.scroller.getBoundingClientRect(), gap = 20;
      const field = input.closest('.ca-field').getBoundingClientRect();
      const control = input.getBoundingClientRect();
      const primary = this.primary?.getBoundingClientRect();
      // Keep the label, input and submit action together when they fit. Long
      // recovery forms still scroll normally; never scroll the document itself.
      const bottom = primary && primary.bottom - field.top <= pane.height - 2*gap ? primary.bottom : control.bottom;
      let delta = bottom > pane.bottom-gap ? bottom-(pane.bottom-gap) : 0;
      if (control.top-delta < pane.top+gap) delta = control.top-(pane.top+gap);
      if (Math.abs(delta) > 1) this.scroller.scrollTop += delta;
    }
    id(key) { return this.model.ids?.[key] || `${this.uid}-${key}`; }
    copy(es, en) { return this.language === 'es' ? es : en; }
    field(key, label, spec = {}) {
      const email = key === 'email';
      const numeric = ['code','confirmCode','otp'].includes(key);
      const secret = ['password','newPassword','confirmPassword','code','confirmCode'].includes(key);
      const max = key === 'otp' ? 10 : numeric ? 8 : undefined;
      const min = key === 'otp' ? 6 : numeric ? 8 : ['newPassword','confirmPassword'].includes(key) ? 10 : undefined;
      const type = email ? 'email' : secret ? 'password' : 'text';
      const autocomplete = email ? 'username' : key === 'password' ? 'current-password' : ['newPassword','confirmPassword'].includes(key) ? 'new-password' : key === 'otp' ? 'one-time-code' : 'off';
      const name = email ? 'username' : key === 'newPassword' ? 'new-password' : key === 'confirmPassword' ? 'confirm-password' : key;
      const id = this.id(key);
      const value = email ? this.model.email || '' : '';
      const input = `<input id="${escape(id)}" name="${name}" data-field="${key}" ${secret ? 'data-secret' : ''} type="${type}" autocomplete="${autocomplete}" ${numeric ? 'inputmode="numeric" pattern="[0-9]*"' : email ? 'inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false"' : ''} ${min ? `minlength="${min}"` : ''} ${max ? `maxlength="${max}"` : ''} ${spec.readonly ? 'readonly' : 'required'} value="${escape(value)}" enterkeyhint="${email ? 'next' : 'go'}" aria-describedby="${escape(this.id('error'))}">`;
      return `<label class="ca-field" for="${escape(id)}"><span>${escape(label)}</span><span class="ca-input-wrap">${input}${secret ? `<button class="ca-reveal" type="button" data-reveal="${key}" aria-controls="${escape(id)}" aria-pressed="false" aria-label="${escape(this.t.show+' '+label)}">${this.t.show}</button>` : ''}</span></label>`;
    }
    action(key, label, primary = false) {
      const conf = this.model.actions?.[key] || {};
      if (conf.hidden) return '';
      const cls = primary ? 'ca-primary' : `ca-link${key === 'forgot' ? ' ca-forgot' : ''}`;
      const attrs = `id="${escape(this.id(key))}" data-action="${key}" class="${cls}"`;
      const text = escape(conf.label || label);
      if (conf.href) {
        const url = new URL(conf.href, location.href);
        if (url.origin !== location.origin || !['https:','http:'].includes(url.protocol)) throw new Error('Auth navigation must stay on the current origin');
        return `<a ${attrs} href="${escape(url.href)}">${text}</a>`;
      }
      return `<button ${attrs} type="${primary && this.hasForm ? 'submit' : 'button'}" ${primary && this.hasForm ? 'disabled' : ''}>${text}</button>`;
    }
    render() {
      const m = this.model, t = this.t, view = m.view || 'login';
      this.setAttribute('data-version', VERSION);
      this.setAttribute('data-view', view);
      this.setAttribute('lang', this.language);
      const systemLight = root.matchMedia?.('(prefers-color-scheme: light)').matches;
      this.setAttribute('data-theme', m.theme === 'light' || m.theme === 'system' && systemLight ? 'light' : 'dark');
      let fields = '', before = '', after = '', title = '', message = '', label = '', tone = m.tone || 'info';
      this.hasForm = ['login','unlock','verify-email','verify-code','password-setup','password-reset','device-setup','recovery-request'].includes(view);
      if (view === 'login') {
        fields = this.field('email',t.email) + this.field('password',t.password);
        before = this.action('forgot',t.forgot); after = this.action('verify',t.verify); label = t.signIn;
      } else if (view === 'unlock') {
        fields = this.field('code',t.code);
        after = this.action('usePassword',t.usePassword) + this.action('logout',t.logout); label = t.unlock;
      } else if (view === 'verify-email') {
        title = this.copy('Verificar acceso','Verify access');
        message = this.copy('Usa un correo previamente autorizado por Clover. Te enviaremos un código de un solo uso.','Use an email already authorized by Clover. We will send a one-time code.');
        fields = this.field('email',t.email); label = t.sendCode; after = this.action('back',t.back);
      } else if (view === 'verify-code') {
        title = this.copy('Revisa tu correo','Check your email');
        message = this.copy('Ingresa el código de verificación enviado a ','Enter the verification code sent to ') + (m.email || '');
        fields = this.field('otp',this.copy('Código de verificación','Verification code')); label = t.verifyCode;
        after = this.action('resend',t.resendCode) + this.action('back',t.back);
      } else if (view === 'password-setup' || view === 'password-reset') {
        title = view === 'password-reset' ? this.copy('Crear nueva contraseña','Create new password') : this.copy('Crear contraseña de Clover','Create your Clover password');
        message = this.copy('Usa al menos 10 caracteres con letras y números.','Use at least 10 characters with letters and numbers.');
        fields = this.field('email',t.account,{readonly:true}) + this.field('newPassword',t.newPassword) + this.field('confirmPassword',t.confirmPassword);
        label = view === 'password-reset' ? t.savePassword : t.continue;
        if (m.actions?.cancel) after = this.action('cancel',t.cancel);
      } else if (view === 'device-setup') {
        title = this.copy('Crear código del dispositivo','Create device code');
        message = this.copy('Elige 8 dígitos para desbloquear este dispositivo. No es tu contraseña de Clover.','Choose 8 digits to unlock this device. This is not your Clover password.');
        fields = this.field('code',t.code) + this.field('confirmCode',t.confirmCode); label = t.saveCode;
      } else if (view === 'recovery-request') {
        title = this.copy('Recuperar contraseña','Recover password');
        fields = this.field('email',t.email); label = t.sendLink; after = this.action('back',t.back);
      } else if (view === 'recovery-sent') {
        title = this.copy('Revisa tu correo','Check your email');
        message = this.copy('Solicitud aceptada. Si existe una cuenta para ','Request accepted. If an account exists for ') + (m.email || '') + this.copy(', recibirás un enlace. Revisa también Spam / No deseado.',', you will receive a link. Also check Spam / Junk.');
        after = this.action('resend',t.resendLink) + this.action('back',t.back);
      } else if (view === 'recovery-verify') {
        title = this.copy('Restablecer contraseña','Reset password');
        message = this.copy('Continúa para verificar tu enlace de recuperación.','Continue to verify your recovery link.');
        label = t.continue; after = this.action('requestNew',t.requestNew);
      } else if (view === 'unauthorized') {
        title = this.copy('Acceso no disponible','Access unavailable');
        message = this.copy('Tu cuenta no tiene acceso a este espacio de trabajo.','Your account does not have access to this workspace.');
        tone = 'error'; after = this.action('logout',t.logout);
      } else if (view === 'expired') {
        title = this.copy('Sesión vencida','Session expired');
        label = t.signIn;
      } else if (view === 'loading') {
        message = t.loading;
      } else if (view === 'success' || view === 'notice') {
        tone = view === 'success' ? 'success' : tone;
        label = m.primaryText || '';
        if (m.actions?.back) after = this.action('back',t.back);
      } else throw new Error(`Unsupported Clover auth view: ${view}`);
      title = m.title ?? title; message = m.message ?? message;
      // Login and unlock intentionally have no redundant page heading.
      if (view === 'login' || view === 'unlock') title = '';
      const brandName = view === 'login' ? 'Clover — Material Handling Solution' : 'Clover';
      const brandLockup = view === 'login' ? "<svg class=\"ca-lockup\" viewBox=\"0 0 280 100\" role=\"img\" aria-label=\"Clover — MATERIAL HANDLING SOLUTION\"><text x=\"4\" y=\"66\" textLength=\"272\" lengthAdjust=\"spacingAndGlyphs\" class=\"ca-wordmark\">Clover</text><text x=\"4\" y=\"96\" textLength=\"272\" lengthAdjust=\"spacing\" class=\"ca-tagline\">MATERIAL HANDLING SOLUTION</text></svg>" : '';
      const status = message ? `<p class="ca-help ca-${escape(tone)}" ${tone === 'error' ? 'role="alert"' : tone === 'success' ? 'role="status"' : ''}>${escape(message)}</p>` : '';
      const content = `${fields}${before}<div class="ca-message" id="${escape(this.id('error'))}" role="alert" aria-live="polite"></div>${label ? this.action('primary',m.primaryText || label,true) : ''}`;
      this.innerHTML = `<div class="ca-viewport"><div class="ca-wrap"><div class="ca-brand" aria-label="${brandName}"><img class="ca-mark" src="${escape(mark)}" width="327" height="326" alt="" draggable="false">${brandLockup}</div><div class="ca-card">${view === 'unlock' && m.name ? `<p class="ca-name">${escape(m.name)}</p>` : ''}${title ? `<h1>${escape(title)}</h1>` : ''}${view === 'loading' ? '<span class="ca-spinner" aria-hidden="true"></span>' : ''}${status}${this.hasForm ? `<form id="${escape(this.id('form'))}" name="clover-${view}" method="post" autocomplete="${view === 'unlock' || view === 'device-setup' ? 'off' : 'on'}">${content}</form>` : content}${after}${m.notice ? `<p class="ca-context">${escape(m.notice)}</p>` : ''}${m.actions?.language ? this.action('language',this.language === 'es' ? 'English' : 'Español') : ''}</div></div></div>`;
      this.primary = this.querySelector('[data-action="primary"]');
      this.primaryText = this.primary?.textContent || '';
      this.addEventListener('input', this.onInput ||= () => this.refresh());
      this.addEventListener('change', this.onInput);
      this.addEventListener('focusin', this.onInput);
      this.addEventListener('animationstart', this.onInput);
      this.querySelectorAll('[data-reveal]').forEach(button => button.addEventListener('click', () => {
        const input = this.querySelector(`[data-field="${button.dataset.reveal}"]`);
        const reveal = input.type === 'password'; input.type = reveal ? 'text' : 'password';
        button.textContent = reveal ? t.hide : t.show;
        button.setAttribute('aria-pressed',String(reveal));
        button.setAttribute('aria-label',`${reveal ? t.hide : t.show} ${input.closest('label').firstElementChild.textContent}`);
      }));
      this.querySelector('form')?.addEventListener('submit', event => {
        event.preventDefault(); this.refresh();
        if (this.primary?.disabled) event.stopImmediatePropagation();
      });
      this.refresh();
    }
    refresh() {
      if (!this.model) return;
      const now = Date.now();
      for (const [button, item] of this.cooldowns) {
        const seconds = Math.max(0,Math.ceil((item.until-now)/1000));
        button.disabled = seconds > 0 || this.pending;
        button.textContent = seconds > 0 ? `${item.label} (${seconds}s)` : item.label;
        if (!seconds) this.cooldowns.delete(button);
      }
      const fields = [...this.querySelectorAll('input[required]:not(:disabled)')];
      const eligible = fields.every(input => {
        const value = input.value;
        if (!value || !input.checkValidity()) return false;
        if (input.type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
        if (['code','confirmCode'].includes(input.dataset.field)) return /^\d{8}$/.test(value);
        if (input.dataset.field === 'otp') return /^\d{6,10}$/.test(value);
        if (['newPassword','confirmPassword'].includes(input.dataset.field)) return value.length >= 10;
        return true;
      });
      if (this.primary?.tagName === 'BUTTON') this.primary.disabled = this.pending || this.cooldowns.has(this.primary) || !eligible;
    }
    setBusy(pending, label) {
      if (pending && !this.pending) {
        this.beforeBusy = [...this.querySelectorAll('input')].map(input => [input,input.readOnly]);
        this.beforeBusy.forEach(([input]) => { input.readOnly = true; });
      } else if (!pending && this.pending) this.beforeBusy?.forEach(([input,readonly]) => { input.readOnly = readonly; });
      this.pending = !!pending;
      this.setAttribute('aria-busy',String(this.pending));
      if (this.primary) {
        this.primary.textContent = pending ? label || this.t.pending : label || this.primaryText;
        if (!pending && label) this.primaryText = label;
      }
      this.querySelectorAll('button[data-action]:not([data-action="primary"]),button[data-reveal]').forEach(button => {
        // Password re-entry and logout stay available during local unlock.
        const escapeAction = this.model.view === 'unlock' && ['usePassword','logout'].includes(button.dataset.action);
        button.disabled = this.pending && !escapeAction || this.cooldowns.has(button);
      });
      this.refresh();
    }
    setError(message) {
      const el = this.querySelector('.ca-message');
      el.textContent = message || '';
      el.classList.toggle('ca-error',!!message);
    }
    cooldown(button, seconds, label) {
      this.cooldowns.set(button,{until:Date.now()+Math.max(0,seconds)*1000,label:label || button.textContent});
      this.refresh();
    }
  }
  if (!customElements.get('clover-auth-shell')) customElements.define('clover-auth-shell',CloverAuthShell);
  root.CloverAuthUI = Object.freeze({
    version:VERSION,
    mount(container, model) {
      if (!container?.replaceChildren) throw new TypeError('A mount element is required');
      const shell = new CloverAuthShell().configure(model);
      container.replaceChildren(shell);
      container.scrollTop = 0;
      return shell;
    },
    unmount(container) { container?.querySelectorAll('clover-auth-shell').forEach(shell => shell.remove()); },
    busy(button, value, label) { button?.closest('clover-auth-shell')?.setBusy(value,label); },
    countdown(button, seconds, label) { button?.closest('clover-auth-shell')?.cooldown(button,seconds,label); }
  });
})(window);
