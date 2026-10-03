/* Clover Shared Header v1.1 — Inspection adapter.
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
    const s = status(), button = $('syncNowBtn');
    if (!button) return;
    button.className = 'shell-iconbtn shell-sync shell-neutral sync-state-' + s.state;
    button.dataset.syncState = s.state;
    button.title = text('Datos y sincronización: ','Data & sync: ') + s.label;
    button.setAttribute('aria-label', button.title);
    // This adapter has no server connection, so it never emits synced/syncing.
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
  function details() {
    open(`<div id="headerSyncDetails"><h2 id="headerPanelTitle">${text('Datos y sincronización','Data & sync')}</h2>
      <div class="sync-details-status" role="status" aria-live="polite"><span id="headerDetailDot" class="sync-detail-dot"></span><span><b id="headerSyncLabel"></b><small>${text('Sin conexión con el servidor de Clover.','Not connected to the Clover server.')}</small></span></div>
      <div class="setting-row"><span><b id="headerLocalLabel"></b><small id="headerLocalDetail"></small></span></div>
      <p class="small muted">${text('Los registros, fotos y videos permanecen en este dispositivo. Guardar ahora no los envía a otro dispositivo.','Records, photos and videos remain on this device. Save now does not send them to another device.')}</p>
      <button id="headerSaveNow" class="setting-action" type="button">${text('Guardar ahora','Save now')}</button>
      <p class="small muted">${text('El respaldo JSON no incluye fotos ni videos. No borres datos ni reinstales para actualizar.','JSON backup does not include photos or videos. Do not clear data or reinstall to update.')}</p>
      <button id="headerDataSettings" class="setting-action" type="button">${text('Abrir ajustes','Open settings')}</button></div>`, $('syncNowBtn'));
    $('headerSaveNow').onclick = async () => {
      const button = $('headerSaveNow'); if (busy) return; busy = true; button.disabled = true;
      try { await api.save(); } finally { busy = false; if (button.isConnected) button.disabled = false; refresh(); }
    };
    $('headerDataSettings').onclick = () => api.openSettings();
    refresh();
  }
  async function guarded(action) {
    if (busy) return; busy = true;
    try {
      // Uses the engine's media-queue flush and transactional local save.
      // Failure keeps the current work view; navigation does not proceed.
      if (!await api.save()) { details(); return; }
      await action();
    } finally { busy = false; refresh(); }
  }
  function launcher(home = false) {
    open(`<div class="workspace-drawer"><h2 id="headerPanelTitle">${home ? text('Inicio de Clover','Clover Home') : text('Espacios de trabajo','Workspaces')}</h2>
      <p class="small muted">${text('Lanzador local. El portal compartido de Clover aún no está conectado aquí.','Local launcher. The shared Clover portal is not connected here yet.')}</p>
      <div class="workspace-switch-list">
        <button id="headerOpenInspections" class="workspace-switch current" type="button"><span><b>${text('Inspecciones','Inspections')}</b><small>${text('Espacio actual · trabajo guardado en este dispositivo','Current workspace · work saved on this device')}</small></span><span aria-hidden="true">›</span></button>
        <button id="headerOpenProspects" class="workspace-switch" type="button"><span><b>${text('Prospectos','Prospects')}</b><small>${text('Abrir el espacio de Asesores; usa su propio inicio de sesión','Open Advisor workspace; it uses its own sign-in')}</small></span><span aria-hidden="true">↗</span></button>
      </div><p class="small muted">${text('Solo se muestran destinos verificados. Cambiar de espacio no transfiere inspecciones ni evidencia.','Only verified destinations are shown. Switching workspaces does not transfer inspections or evidence.')}</p></div>`, home ? $('cloverHomeBtn') : $('workspaceMenuBtn'));
    $('headerOpenInspections').onclick = () => guarded(() => { api.closeSheet(); api.showHome(); });
    $('headerOpenProspects').onclick = () => guarded(() => { window.location.assign(prospectsURL); });
  }
  function syncHeight() {
    const header = $('cloverHeader');
    if (header) document.documentElement.style.setProperty('--shell-header-height', Math.ceil(header.getBoundingClientRect().height) + 'px');
  }
  function theme() {
    const dark = document.body.dataset.theme === 'dark';
    const root = document.documentElement;
    root.dataset.theme = dark ? 'dark' : 'light';
    root.style.colorScheme = dark ? 'dark' : 'light';
    $('themeMeta')?.setAttribute('content', dark ? '#0F1117' : '#F4F5F7');
    $('statusBarMeta')?.setAttribute('content', dark ? 'black-translucent' : 'default');
  }
  function mount(adapter) {
    if (api) return;
    api = adapter;
    const labels = {
      workspaceMenuBtn: text('Cambiar espacio de trabajo','Switch workspace'),
      cloverHomeBtn: text('Inicio de Clover','Clover Home'),
      globalNewBtn: text('Nueva inspección','New inspection'),
      settingsBtn: text('Ajustes','Settings')
    };
    for (const [id,label] of Object.entries(labels)) {
      const button = $(id); button.title = label; button.setAttribute('aria-label',label); button.disabled = false;
    }
    $('syncNowBtn').disabled = false;
    // Soft break only matters on unusually narrow displays; no text is truncated.
    $('brandSubtitle').innerHTML = api.lang === 'es' ? 'Inspec<wbr>ciones' : 'Inspec<wbr>tions';
    $('workspaceMenuBtn').onclick = () => launcher(false);
    $('cloverHomeBtn').onclick = () => launcher(true);
    $('syncNowBtn').onclick = details;
    $('globalNewBtn').onclick = () => guarded(() => api.openNew());
    $('settingsBtn').onclick = () => api.openSettings();
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
  }
  window.CloverSharedHeader = Object.freeze({mount,refresh});
})();
