/* Clover Inspection adapter for the canonical Clover UI Header Component v1.0.0.
 * Shell only. It neither opens a database nor owns records, authentication or sync.
 * Local saves MUST NOT be presented as server acknowledgements.
 */
(() => {
  'use strict';
  let api = null, busy = false, lastFocus = null;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text = (es,en) => api.lang === 'es' ? es : en;
  // Only established destinations. Not a customer/location catalog or a permissions list.
  const prospectsURL = 'https://kevinmdoca-hub.github.io/clover-prospect-pilot/';
  function status() {
    const local = api.getSaveState();
    const state = local.kind === 'bad' ? 'error' : local.kind === 'saving' ? 'pending' : navigator.onLine === false ? 'offline' : 'local';
    const label = state === 'error' ? text('Error de guardado local','Local save error') : state === 'pending' ? text('Guardado local pendiente','Local save pending') : state === 'offline' ? text('Sin conexión · solo local','Offline · local only') : text('Solo local · sin sincronización','Local only · no server sync');
    return {state,label,local};
  }
  function refresh() {
    if (!api) return;
    const s = status(), header = $('cloverHeader');
    if (!header) return;
    // v1 has no "local" state. Gray/offline means no cloud connection here,
    // even with working Wi-Fi. The detail panel states "Local only" explicitly.
    header.setAttribute('sync-state', s.state === 'local' ? 'offline' : s.state);
    header.toggleAttribute('create-disabled', busy);
    // No local save is ever mapped to the component's server-synced green.
    if ($('headerSyncDetails')) {
      $('headerSyncLabel').textContent = s.label;
      $('headerLocalLabel').textContent = s.local.title || text('Estado local pendiente de verificar','Local state not yet verified');
      $('headerLocalDetail').textContent = s.local.sub || '';
      $('headerDetailDot').className = 'sync-detail-dot state-' + s.state;
    }
  }
  function open(content, trigger) {
    lastFocus = trigger || document.activeElement;
    api.openSheet(content);
    const panel = $('sheet');
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-modal','true');
    if ($('headerPanelTitle')) panel.setAttribute('aria-labelledby','headerPanelTitle');
    $('sheetClose')?.focus({preventScroll:true});
  }
  function details(trigger) {
    open(`<div id="headerSyncDetails"><h2 id="headerPanelTitle">${text('Datos y sincronización','Data & sync')}</h2>
      <div class="sync-details-status" role="status" aria-live="polite"><span id="headerDetailDot" class="sync-detail-dot"></span><span><b id="headerSyncLabel"></b><small>${text('Sin conexión con el servidor de Clover.','Not connected to the Clover server.')}</small></span></div>
      <div class="setting-row"><span><b id="headerLocalLabel"></b><small id="headerLocalDetail"></small></span></div>
      <p class="small muted">${text('Los registros, fotos y videos permanecen en este dispositivo. Guardar ahora no los envía a otro dispositivo.','Records, photos and videos remain on this device. Save now does not send them to another device.')}</p>
      <button id="headerSaveNow" class="setting-action" type="button">${text('Guardar ahora','Save now')}</button>
      <p class="small muted">${text('El respaldo JSON no incluye fotos ni videos. No borres datos ni reinstales para actualizar.','JSON backup does not include photos or videos. Do not clear data or reinstall to update.')}</p>
      <button id="headerDataSettings" class="setting-action" type="button">${text('Abrir ajustes','Open settings')}</button></div>`, trigger);
    $('headerSaveNow').onclick = async () => {
      const button = $('headerSaveNow'); if (busy) return; busy = true; refresh(); button.disabled = true;
      try { await api.save(); } finally { busy = false; if (button.isConnected) button.disabled = false; refresh(); }
    };
    $('headerDataSettings').onclick = () => api.openSettings();
    refresh();
  }
  async function guarded(action) {
    if (busy) return; busy = true; refresh();
    try {
      // Uses the engine's media-queue flush and transactional local save.
      // Failure keeps the current work view; navigation does not proceed.
      if (!await api.save()) { details(); return; }
      await action();
    } finally { busy = false; refresh(); }
  }
  function launcher(home = false, trigger) {
    open(`<div class="workspace-drawer"><h2 id="headerPanelTitle">${home ? text('Inicio de Clover','Clover Home') : text('Espacios de trabajo','Workspaces')}</h2>
      <p class="small muted">${text('Lanzador local. El portal compartido de Clover aún no está conectado aquí.','Local launcher. The shared Clover portal is not connected here yet.')}</p>
      <div class="workspace-switch-list">
        <button id="headerOpenInspections" class="workspace-switch current" type="button"><span><b>${text('Inspecciones','Inspections')}</b><small>${text('Espacio actual · trabajo guardado en este dispositivo','Current workspace · work saved on this device')}</small></span><span aria-hidden="true">›</span></button>
        <button id="headerOpenProspects" class="workspace-switch" type="button"><span><b>${text('Prospectos','Prospects')}</b><small>${text('Abrir el espacio de Asesores; usa su propio inicio de sesión','Open Advisor workspace; it uses its own sign-in')}</small></span><span aria-hidden="true">↗</span></button>
      </div><p class="small muted">${text('Solo se muestran destinos verificados. Cambiar de espacio no transfiere inspecciones ni evidencia.','Only verified destinations are shown. Switching workspaces does not transfer inspections or evidence.')}</p></div>`, trigger);
    $('headerOpenInspections').onclick = () => guarded(() => { api.closeSheet(); api.showHome(); });
    $('headerOpenProspects').onclick = () => guarded(() => { window.location.assign(prospectsURL); });
  }
  function syncHeight() {
    const header = $('cloverHeader');
    if (header) document.documentElement.style.setProperty('--shell-header-height', Math.ceil(header.getBoundingClientRect().height) + 'px');
  }
  function theme() {
    const dark = document.body.dataset.theme === 'dark';
    $('cloverHeader')?.setAttribute('theme', dark ? 'dark' : 'light');
    const root = document.documentElement;
    root.dataset.theme = dark ? 'dark' : 'light';
    root.style.colorScheme = dark ? 'dark' : 'light';
    $('themeMeta')?.setAttribute('content', dark ? '#0F1117' : '#F4F5F7');
    $('statusBarMeta')?.setAttribute('content', dark ? 'black-translucent' : 'default');
  }
  function mount(adapter) {
    if (api) return;
    api = adapter;
    const header = $('cloverHeader');
    // Use the documented workspace name. v1's labels are shipped in English;
    // translations/visual fixes belong to the component owner, not this app.
    header.setAttribute('workspace-name', 'Inspections');
    header.addEventListener('clover-menu', e => launcher(false, e.composedPath()[0]));
    header.addEventListener('clover-home', e => launcher(true, e.composedPath()[0]));
    header.addEventListener('clover-create', () => guarded(() => api.openNew()));
    header.addEventListener('clover-sync', e => details(e.composedPath()[0]));
    header.addEventListener('clover-settings', () => api.openSettings());
    window.addEventListener('clover:local-save',refresh);
    window.addEventListener('online',refresh); window.addEventListener('offline',refresh);
    window.addEventListener('resize',syncHeight);
    new MutationObserver(theme).observe(document.body,{attributes:true,attributeFilter:['data-theme']});
    if (window.ResizeObserver) new ResizeObserver(syncHeight).observe($('cloverHeader'));
    // Keyboard close/containment for the shell's status and launcher sheets.
    document.addEventListener('keydown', e => {
      if (!$('headerPanelTitle') || $('sheet').classList.contains('hidden')) return;
      if (e.key === 'Escape') { e.preventDefault(); api.closeSheet(); lastFocus?.focus({preventScroll:true}); }
      if (e.key === 'Tab') {
        const buttons = [...$('sheet').querySelectorAll('button:not(:disabled),a[href],input,select')].filter(x=>x.getClientRects().length);
        const first=buttons[0],last=buttons.at(-1);
        if (e.shiftKey && document.activeElement === first) {e.preventDefault();last?.focus();}
        else if (!e.shiftKey && document.activeElement === last) {e.preventDefault();first?.focus();}
      }
    });
    // Don't leave a stale aria-labelledby when the app reuses the shared sheet.
    new MutationObserver(() => {if (!$('headerPanelTitle')) $('sheet')?.removeAttribute('aria-labelledby');}).observe($('sheet'),{childList:true});
    theme(); refresh(); syncHeight();
    customElements.whenDefined('clover-shell-header').then(syncHeight);
  }
  $('cloverHeader')?.setAttribute('theme', document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  window.CloverInspectionHeader = Object.freeze({mount,refresh});
})();
