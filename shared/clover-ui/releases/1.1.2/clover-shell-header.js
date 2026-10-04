/* Clover UI Header 1.1.2. Canonical source: consume unchanged; wire events only. */
const VERSION = '1.1.2';
const CSS_URL = new URL('./clover-shell-header.css?v=1.1.2', import.meta.url).href;
const BRAND_URL = new URL('./clover-brand-mark-v1.png', import.meta.url).href;
const svg = (body, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;
const icons = {
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  create: svg('<path d="M12 5v14M5 12h14"/>'),
  sync: svg('<path d="M5 17H4.7A3.7 3.7 0 0 1 3.4 9.8 6.2 6.2 0 0 1 15 6.2a4.7 4.7 0 0 1 6.1 4.4A3.5 3.5 0 0 1 20 17h-1"/><g class="sync-arrows"><path d="M8.3 13a4.3 4.3 0 0 1 7.8 1.2M16.2 11.9v2.6h-2.6M15.7 19a4.3 4.3 0 0 1-7.8-1.2M7.8 20.1v-2.6h2.6"/></g>'),
  settings: svg('<path d="M9.4 2.5h5.2l.5 2.8 1.5.6 2.3-1.6 3.7 3.7-1.6 2.3.6 1.5 2.8.5v5.2l-2.8.5-.6 1.5 1.6 2.3-3.7 3.7-2.3-1.6-1.5.6-.5 2.8H9.4l-.5-2.8-1.5-.6-2.3 1.6-3.7-3.7L3 19.5l-.6-1.5L-.4 17.5v-5.2l2.8-.5.6-1.5L1.4 8l3.7-3.7 2.3 1.6 1.5-.6Z" transform="translate(2.4 .08) scale(.8)"/><circle cx="12" cy="12" r="3.5"/>')
};
const mark = `<img class="brand-mark" src="${BRAND_URL}" width="30" height="30" alt="" aria-hidden="true" draggable="false">`;
class CloverShellHeader extends HTMLElement {
  static version = VERSION;
  static get observedAttributes() { return ['workspace-name','sync-state','theme','create-disabled','lang']; }
  constructor() {
    super();
    const root = this.attachShadow({mode:'open'});
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = CSS_URL;
    css.addEventListener('load', () => this.setAttribute('data-style-ready','true'));
    css.addEventListener('error', () => this.dispatchEvent(new CustomEvent('clover-header-error',{bubbles:true,composed:true,detail:{reason:'stylesheet-load',url:CSS_URL}})));
    root.append(css);
    const box = document.createElement('header'); box.className = 'header';
    box.innerHTML = `<div class="row"><button class="control menu" type="button" data-action="menu">${icons.menu}</button><div class="identity"><button class="home" type="button" data-action="home">${mark}</button><h1 class="title"></h1></div><div class="actions"><button class="control create" type="button" data-action="create">${icons.create}</button><button class="control sync" type="button" data-action="sync">${icons.sync}<span class="dot" aria-hidden="true"></span></button><button class="control settings" type="button" data-action="settings">${icons.settings}</button></div></div>`;
    root.append(box);
    this.$title = root.querySelector('.title'); this.$sync = root.querySelector('.sync'); this.$dot = root.querySelector('.dot'); this.$create = root.querySelector('.create');
    root.addEventListener('click', e => {
      const button = e.target.closest?.('button[data-action]');
      if (button && !button.disabled) this.dispatchEvent(new CustomEvent(`clover-${button.dataset.action}`,{bubbles:true,composed:true}));
    });
  }
  connectedCallback() { this.setAttribute('data-component-version',VERSION); this.render(); }
  attributeChangedCallback() { if (this.$title) this.render(); }
  render() {
    const name = (this.getAttribute('workspace-name') || 'Clover').trim();
    const state = ['synced','syncing','pending','offline','error'].includes(this.getAttribute('sync-state')) ? this.getAttribute('sync-state') : 'offline';
    this.$title.textContent = name;
    this.$title.dataset.length = name.length >= 16 ? 'long' : name.length >= 13 ? 'medium' : 'short';
    this.$sync.dataset.state = this.$dot.dataset.state = state;
    this.$create.disabled = this.hasAttribute('create-disabled');
    const es = (this.getAttribute('lang') || document.documentElement.lang || 'en').startsWith('es');
    const states = es ? {synced:'Sincronizado',syncing:'Sincronizando',pending:'Cambios pendientes',offline:'Sin conexión',error:'Error de sincronización'} : {synced:'Synced',syncing:'Syncing',pending:'Changes pending',offline:'Offline',error:'Sync error'};
    const labels = es ? {menu:'Abrir espacios de Clover',home:'Inicio de Clover',create:'Crear',settings:'Configuración',sync:`Sincronización: ${states[state]}`} : {menu:'Open Clover workspaces',home:'Clover home',create:'Create',settings:'Settings',sync:`Sync status: ${states[state]}`};
    for (const button of this.shadowRoot.querySelectorAll('button[data-action]')) { button.setAttribute('aria-label',labels[button.dataset.action]); button.title = labels[button.dataset.action]; }
  }
}
const registered = customElements.get('clover-shell-header');
if (!registered) customElements.define('clover-shell-header',CloverShellHeader);
else if (registered.version !== VERSION) console.error('Clover header version conflict. Remove the older import and reload normally; do not clear application data.');
window.CloverUI = Object.freeze({...window.CloverUI,shellHeaderVersion:customElements.get('clover-shell-header').version || 'unversioned'});
