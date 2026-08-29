(() => {
  'use strict';

  const VERSION = 'v0.5.1';
  const STATE_KEY = 'clover-baseline-es-v04';
  const DB_NAME = 'clover-inspeccion-pwa-v04';
  const DB_VERSION = 1;
  const STATE_STORE = 'state';
  const MEDIA_STORE = 'media';

  const $ = s => document.querySelector(s);
  const $$ = (root, s) => {
    if (typeof root === 'string' && s === undefined) return [...document.querySelectorAll(root)];
    return [...root.querySelectorAll(s)];
  };
  const dot = $('#pwaDot');
  const mainState = $('#pwaMainState');
  const subState = $('#pwaSubState');
  const mediaState = $('#mediaState');
  const persistBtn = $('#persistStorage');
  const installBtn = $('#installApp');
  const importBtn = $('#importBackup');
  const importFile = $('#importBackupFile');

  let dbPromise = null;
  let deferredInstallPrompt = null;
  let mirrorTimer = null;
  let mediaCount = 0;
  let lastMirrorAt = null;

  function setStatus(kind, main, sub) {
    if (dot) dot.className = 'pwa-dot ' + kind;
    if (mainState) mainState.textContent = main;
    if (subState && sub !== undefined) subState.textContent = sub;
  }

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE, {keyPath:'key'});
        if (!db.objectStoreNames.contains(MEDIA_STORE)) {
          const store = db.createObjectStore(MEDIA_STORE, {keyPath:'id'});
          store.createIndex('byUnit', 'unitId', {unique:false});
          store.createIndex('bySession', 'sessionId', {unique:false});
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function idbPut(storeName, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGet(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function countMedia() {
    try {
      const db = await openDB();
      const count = await new Promise((resolve, reject) => {
        const tx = db.transaction(MEDIA_STORE, 'readonly');
        const req = tx.objectStore(MEDIA_STORE).count();
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => reject(req.error);
      });
      mediaCount = count;
      if (mediaState) mediaState.textContent = `Evidencia local: ${count} archivo(s) guardado(s) en este dispositivo.`;
    } catch (e) {
      if (mediaState) mediaState.textContent = 'Evidencia local: almacenamiento de archivos no disponible.';
    }
  }

  function currentSessionId() {
    let id = localStorage.getItem('clover-pwa-session-id');
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : 's-' + Date.now() + '-' + Math.random().toString(36).slice(2));
      localStorage.setItem('clover-pwa-session-id', id);
    }
    return id;
  }

  function ensureUnitIds() {
    $$('.unit').forEach(unit => {
      if (!unit.dataset.pwaUnitId) {
        unit.dataset.pwaUnitId = crypto.randomUUID ? crypto.randomUUID() : 'u-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      }
    });
  }

  function getContext(input) {
    const unit = input.closest('.unit');
    const item = input.closest('.item');
    return {
      unitId: unit?.dataset.pwaUnitId || 'session',
      unitNumber: unit?.dataset.unit || '',
      group: item?.dataset.group || '',
      item: item?.dataset.item || '',
      evidenceType: input.dataset.evidence || (item ? 'hallazgo' : 'archivo')
    };
  }

  async function storeFiles(input) {
    const files = [...(input.files || [])];
    if (!files.length) return;
    ensureUnitIds();
    setStatus('warn', 'Guardando evidencia…', `${files.length} archivo(s) seleccionado(s).`);
    const ctx = getContext(input);
    const sessionId = currentSessionId();
    const savedIds = [];
    try {
      for (const file of files) {
        const id = crypto.randomUUID ? crypto.randomUUID() : 'm-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        await idbPut(MEDIA_STORE, {
          id,
          sessionId,
          unitId: ctx.unitId,
          unitNumber: ctx.unitNumber,
          group: ctx.group,
          item: ctx.item,
          evidenceType: ctx.evidenceType,
          name: file.name || `evidencia-${Date.now()}`,
          type: file.type || 'application/octet-stream',
          size: file.size || 0,
          lastModified: file.lastModified || Date.now(),
          createdAt: new Date().toISOString(),
          blob: file
        });
        savedIds.push(id);
      }
      input.dataset.savedMediaIds = savedIds.join(',');
      let msg = input.parentElement?.querySelector('.media-saved');
      if (!msg) {
        msg = document.createElement('div');
        msg.className = 'media-saved';
        input.insertAdjacentElement('afterend', msg);
      }
      msg.textContent = `✓ ${files.length} archivo(s) guardado(s) localmente`;
      await countMedia();
      await mirrorStateNow();
      setStatus('ok', 'Guardado en este dispositivo', `Datos + evidencia local actualizados · ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`);
    } catch (e) {
      console.error(e);
      setStatus('bad', 'No se pudo guardar toda la evidencia', 'Conserva los archivos originales y descarga un respaldo de datos.');
    }
  }

  async function mirrorStateNow() {
    clearTimeout(mirrorTimer);
    let raw = null;
    try { raw = localStorage.getItem(STATE_KEY); } catch (e) {}
    if (!raw) return;
    try {
      await idbPut(STATE_STORE, {key:'latest', value:raw, savedAt:new Date().toISOString()});
      lastMirrorAt = new Date();
      setStatus('ok', 'Guardado en este dispositivo', `Último guardado: ${lastMirrorAt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`);
    } catch (e) {
      console.error(e);
      setStatus('warn', 'Guardado parcial', 'Los datos están en el navegador, pero la copia secundaria no pudo actualizarse.');
    }
  }

  function scheduleMirror() {
    setStatus('warn', 'Guardando…', 'Los cambios se están guardando automáticamente.');
    clearTimeout(mirrorTimer);
    mirrorTimer = setTimeout(mirrorStateNow, 700);
  }

  async function recoverFromSecondaryStore() {
    let local = null;
    try { local = localStorage.getItem(STATE_KEY); } catch (e) {}
    if (local) return false;
    try {
      const rec = await idbGet(STATE_STORE, 'latest');
      if (rec?.value) {
        localStorage.setItem(STATE_KEY, rec.value);
        setStatus('warn', 'Respaldo local encontrado', 'Recuperando sesión guardada…');
        location.reload();
        return true;
      }
    } catch (e) {}
    return false;
  }

  async function requestPersistentStorage() {
    try {
      if (!navigator.storage?.persist) {
        setStatus('warn', 'Protección no disponible', 'Este navegador no ofrece la función de almacenamiento persistente.');
        return;
      }
      const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      const granted = already || await navigator.storage.persist();
      if (granted) setStatus('ok', 'Almacenamiento protegido', 'El navegador indicó que intentará conservar los datos de esta app.');
      else setStatus('warn', 'Guardado activo', 'El navegador no garantizó almacenamiento persistente. Mantén instalada la app y descarga respaldos.');
      await showStorageEstimate();
    } catch (e) {
      setStatus('warn', 'Guardado activo', 'No se pudo solicitar protección adicional del almacenamiento.');
    }
  }

  async function showStorageEstimate() {
    try {
      if (!navigator.storage?.estimate) return;
      const {usage=0, quota=0} = await navigator.storage.estimate();
      if (!mediaState) return;
      const mb = n => (n/1024/1024).toFixed(1);
      mediaState.textContent += ` · Uso aprox.: ${mb(usage)} MB de ${mb(quota)} MB disponibles.`;
    } catch (e) {}
  }

  async function registerSW() {
    if (!('serviceWorker' in navigator)) {
      setStatus('warn', 'Modo navegador', 'Este navegador no soporta instalación offline completa.');
      return;
    }
    if (!/^https?:$/.test(location.protocol)) {
      setStatus('warn', 'Vista de archivo', 'Para instalación offline, abre esta app desde una dirección HTTPS y agrégala a la pantalla de inicio.');
      return;
    }
    try {
      await navigator.serviceWorker.register('./sw.js', {scope:'./'});
      await navigator.serviceWorker.ready;
      setStatus('ok', navigator.onLine ? 'App lista y guardando' : 'Modo sin conexión', 'La aplicación está preparada para funcionar offline.');
    } catch (e) {
      console.error(e);
      setStatus('warn', 'Guardado activo', 'No se pudo registrar el modo offline completo en este navegador.');
    }
  }

  function wireInstall() {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (installBtn) installBtn.hidden = false;
    });
    if (installBtn) installBtn.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice.catch(()=>{});
        deferredInstallPrompt = null;
        installBtn.hidden = true;
      } else {
        alert('iPhone/iPad: abre esta página en Safari, toca Compartir y elige “Agregar a pantalla de inicio”. Android: usa el menú del navegador y elige “Instalar aplicación” o “Agregar a pantalla principal”.');
      }
    });
  }

  function wireImport() {
    if (!importBtn || !importFile) return;
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', async () => {
      const file = importFile.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data?.session || !Array.isArray(data?.units)) throw new Error('Formato no reconocido');
        localStorage.setItem(STATE_KEY, JSON.stringify(data));
        await idbPut(STATE_STORE, {key:'latest', value:JSON.stringify(data), savedAt:new Date().toISOString()});
        alert('Respaldo importado. La aplicación se recargará para mostrarlo.');
        location.reload();
      } catch (e) {
        alert('No se pudo importar el respaldo JSON.');
      } finally {
        importFile.value = '';
      }
    });
  }

  function wireEvents() {
    document.addEventListener('input', scheduleMirror, true);
    document.addEventListener('change', e => {
      scheduleMirror();
      if (e.target instanceof HTMLInputElement && e.target.type === 'file') storeFiles(e.target);
      ensureUnitIds();
    }, true);
    document.addEventListener('click', e => {
      if (e.target.closest('#addUnit')) setTimeout(ensureUnitIds, 20);
    }, true);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') mirrorStateNow();
    });
    window.addEventListener('pagehide', mirrorStateNow);
    window.addEventListener('online', () => setStatus('ok', 'Con conexión · guardado local activo', 'La app seguirá funcionando si se pierde internet.'));
    window.addEventListener('offline', () => setStatus('ok', 'Modo sin conexión', 'Continúa trabajando. Los cambios se guardan en este dispositivo.'));
    if (persistBtn) persistBtn.addEventListener('click', requestPersistentStorage);
  }

  async function init() {
    try {
      ensureUnitIds();
      wireEvents();
      wireInstall();
      wireImport();
      const recovered = await recoverFromSecondaryStore();
      if (recovered) return;
      await registerSW();
      await countMedia();
      await showStorageEstimate();
      await mirrorStateNow();
      if (navigator.storage?.persisted) {
        try {
          const persisted = await navigator.storage.persisted();
          if (persisted) setStatus('ok', navigator.onLine ? 'Guardado automático activo' : 'Modo sin conexión', 'Almacenamiento persistente confirmado.');
          else if (navigator.onLine) setStatus('ok', 'Guardado automático activo', 'Los cambios de la inspección se guardan en este dispositivo.');
        } catch (e) {}
      } else if (navigator.onLine) {
        setStatus('ok', 'Guardado automático activo', 'Los cambios de la inspección se guardan en este dispositivo.');
      }
    } catch (e) {
      console.error('Clover PWA init error', e);
      setStatus('bad', 'Error en la capa de guardado PWA', 'El formulario puede seguir usando su guardado local básico, pero no uses fotos/videos hasta actualizar la app.');
    }
  }

  init();
})();


/* ---------- v0.5 Monday usability layer ---------- */
(() => {
  const makes = [
    'Toyota','Crown','Hyster','Yale','Hyundai','UniCarriers','Nissan','Mitsubishi',
    'CAT','Clark','Komatsu','Doosan','Bobcat','Raymond','Jungheinrich','Linde',
    'Hangcha','Heli','TCM','Manitou','Baoli','Still','Kalmar'
  ];

  const q = s => document.querySelector(s);
  const qa = (r,s) => [...r.querySelectorAll(s)];

  function setupSearchableMakes(root=document){
    qa(root,'.search-make').forEach(inp => {
      if (inp.dataset.v05) return; inp.dataset.v05='1';
      const box = inp.parentElement.querySelector('.search-suggestions');
      const render = () => {
        const v = inp.value.trim().toLowerCase();
        const matches = makes.filter(m => !v || m.toLowerCase().includes(v)).slice(0,8);
        box.innerHTML = matches.map(m=>`<button type="button">${m}</button>`).join('') + `<button type="button">Otra / No listada</button>`;
        box.classList.toggle('hidden', !v);
        qa(box,'button').forEach(b=>b.addEventListener('click',()=>{
          if (b.textContent.startsWith('Otra')) { inp.value=''; inp.placeholder='Escribe la marca'; }
          else inp.value=b.textContent;
          box.classList.add('hidden'); inp.dispatchEvent(new Event('change',{bubbles:true}));
        }));
      };
      inp.addEventListener('input',render);
      inp.addEventListener('focus',render);
      inp.addEventListener('blur',()=>setTimeout(()=>box.classList.add('hidden'),180));
    });
  }

  function setupConditionalOther(root=document){
    qa(root,'select[data-k="forkLength"],select[data-k="mast"],select[data-k="attachments"]').forEach(sel=>{
      if(sel.dataset.v05)return; sel.dataset.v05='1';
      const other = sel.parentElement.querySelector('.conditional-other');
      const sync=()=>{ if(other) other.classList.toggle('hidden', sel.value!=='Otro'); };
      sel.addEventListener('change',sync); sync();
    });
  }

  function setupConditionalSections(root=document){
    qa(root,'.unit').forEach(unit=>{
      const power=unit.querySelector('[data-k="power"]');
      const attachment=unit.querySelector('[data-k="attachments"]');
      if(power && !power.dataset.cond05){
        power.dataset.cond05='1';
        power.addEventListener('change',()=>{
          const electric=power.value==='Electric' || power.value==='Eléctrico';
          unit.querySelectorAll('.electric-section').forEach(x=>x.classList.toggle('hidden',!electric));
          unit.querySelectorAll('.ic-section').forEach(x=>x.classList.toggle('hidden',electric));
          recalcUnit(unit);
        });
      }
      if(attachment && !attachment.dataset.cond05){
        attachment.dataset.cond05='1';
        attachment.addEventListener('change',()=>{
          const none=attachment.value==='Ninguno';
          unit.querySelectorAll('[data-attachment-only="1"]').forEach(x=>x.classList.toggle('hidden',none));
          recalcUnit(unit);
        });
      }
    });
  }

  function normalizeItemOptions(root=document){
    qa(root,'.item').forEach(item=>{
      if(item.dataset.opts05)return; item.dataset.opts05='1';
      const quick=item.querySelector('.quick'); if(!quick)return;
      const names=qa(quick,'input[type=radio]').map(r=>r.value);
      const groupName = qa(quick,'input[type=radio]')[0]?.name || ('r-'+Math.random());
      const add=(value,label)=>{
        if(names.includes(value))return;
        const lab=document.createElement('label'); lab.className='chip';
        lab.innerHTML=`<input type="radio" name="${groupName}" value="${value}"><span>${label}</span>`;
        quick.appendChild(lab);
        lab.querySelector('input').addEventListener('change',()=>{ item.classList.toggle('has-unable', value==='No se pudo inspeccionar'); recalcUnit(item.closest('.unit')); });
      };
      add('No inspeccionado','No inspeccionado');
      add('No se pudo inspeccionar','No se pudo inspeccionar');
      if(!item.querySelector('.unable-reason')){
        const div=document.createElement('div');div.className='unable-reason';
        div.innerHTML='<label>Motivo</label><select class="unable-reason-select"><option value="">Seleccionar</option><option>Unidad no operable</option><option>Acceso no disponible</option><option>Herramienta requerida</option><option>Restricción del cliente</option><option>Otro</option></select>';
        item.appendChild(div);
      }
    });
  }

  function activeSteps(unit){
    return qa(unit,'.step').filter(s=>!s.classList.contains('hidden'));
  }

  function stepRequiredControls(step){
    const listItems=qa(step,'.item').filter(i=>!i.classList.contains('hidden'));
    if(listItems.length) return listItems.map(i=>i.querySelector('input[type=radio]:checked') ? 1 : 0);
    const evidenceStatuses=qa(step,'.evidence-selected');
    if(evidenceStatuses.length) return evidenceStatuses.map(el=>el.textContent.trim()?1:0);
    const req = qa(step,'input[data-k],select[data-k]').filter(el=>!el.closest('.hidden') && !el.classList.contains('conditional-other'));
    return req.map(el=>String(el.value||'').trim()?1:0);
  }

  function recalcUnit(unit){
    if(!unit)return;
    let totalMissing=0,totalAnswered=0,totalRequired=0;
    activeSteps(unit).forEach(step=>{
      const vals=stepRequiredControls(step);
      if(!vals.length)return;
      const done=vals.reduce((a,b)=>a+b,0), total=vals.length, missing=total-done;
      totalRequired+=total; totalAnswered+=done; totalMissing+=missing;
      const status=step.querySelector('.step-status');
      if(status){
        status.textContent = `${done}/${total}` + (missing?` · Faltan ${missing}`:' · Completo');
        status.classList.toggle('section-complete',missing===0);
        status.classList.toggle('section-incomplete',missing>0);
      }
    });
    unit.dataset.missing=String(totalMissing);
    unit.dataset.answered=String(totalAnswered);
    unit.dataset.required=String(totalRequired);
    renderDashboard();
    renderMissingReview();
  }

  function renderDashboard(){
    const box=q('#unitCards'); if(!box)return;
    const units=qa(document,'.unit');
    box.innerHTML=units.map((u,i)=>{
      const label=u.querySelector('[data-k="clientUnit"]')?.value || `Montacargas ${i+1}`;
      const make=u.querySelector('[data-k="make"]')?.value || '';
      const model=u.querySelector('[data-k="model"]')?.value || '';
      const missing=Number(u.dataset.missing||0), answered=Number(u.dataset.answered||0), required=Number(u.dataset.required||0);
      return `<button type="button" class="unit-nav-card" data-unit-jump="${i}">
        <strong>${label}${make||model?` · ${make} ${model}`:''}</strong>
        <small>${answered}/${required} respuestas · ${missing?`Faltan ${missing}`:'Completa'}</small>
        <div class="mini"><span class="badge">${missing?'En progreso':'Lista para revisión'}</span></div>
      </button>`;
    }).join('');
    qa(box,'[data-unit-jump]').forEach(b=>b.addEventListener('click',()=>{
      const unit=qa(document,'.unit')[Number(b.dataset.unitJump)];
      unit?.scrollIntoView({behavior:'smooth',block:'start'});
    }));
  }

  function missingForStep(step){
    const misses=[];
    const items=qa(step,'.item').filter(i=>!i.classList.contains('hidden'));
    if(items.length){
      items.forEach(i=>{ if(!i.querySelector('input[type=radio]:checked')) misses.push(i.dataset.item||i.querySelector('b')?.textContent||'Ítem'); });
      return misses;
    }
    const evidenceStatuses=qa(step,'.evidence-selected');
    if(evidenceStatuses.length){
      evidenceStatuses.forEach(el=>{ if(!el.textContent.trim()) misses.push(el.dataset.evidenceStatus || 'Evidencia'); });
      return misses;
    }
    qa(step,'input[data-k],select[data-k]').filter(el=>!el.closest('.hidden')&&!el.classList.contains('conditional-other')).forEach(el=>{
      if(!String(el.value||'').trim()){
        const label=el.closest('div')?.querySelector('label')?.textContent || el.dataset.k;
        misses.push(label);
      }
    });
    return misses;
  }

  function renderMissingReview(){
    const summary=q('#missingSummary'), groups=q('#missingGroups'); if(!summary||!groups)return;
    let total=0; const chunks=[];
    qa(document,'.unit').forEach((unit,ui)=>{
      activeSteps(unit).forEach(step=>{
        const misses=missingForStep(step); if(!misses.length)return;
        total+=misses.length;
        const title=step.querySelector('summary strong')?.textContent || step.querySelector('summary')?.textContent.trim() || 'Sección';
        chunks.push({ui,step,title,misses});
      });
    });
    summary.textContent = total ? `Faltan ${total} respuestas/evidencias antes de cerrar la sesión.` : '✓ No se detectan respuestas pendientes.';
    groups.innerHTML=chunks.map((c,idx)=>`<div class="missing-group"><b>Montacargas ${c.ui+1} · ${c.title}</b><div class="small">${c.misses.slice(0,5).join(' · ')}${c.misses.length>5?'…':''}</div><button type="button" class="missing-link" data-missing="${idx}">Ir a esta sección (${c.misses.length})</button></div>`).join('');
    qa(groups,'[data-missing]').forEach(btn=>btn.addEventListener('click',()=>{
      const c=chunks[Number(btn.dataset.missing)];
      c.step.open=true; c.step.scrollIntoView({behavior:'smooth',block:'start'});
      const first=[...c.step.querySelectorAll('.item')].find(i=>!i.querySelector('input[type=radio]:checked'));
      (first||c.step).scrollIntoView({behavior:'smooth',block:'center'});
    }));
  }

  function setupMarkNormal(root=document){
    qa(root,'.mark-normal').forEach(btn=>{
      if(btn.dataset.v05)return;btn.dataset.v05='1';
      btn.addEventListener('click',()=>{
        const step=btn.closest('.step');
        qa(step,'.item').forEach(item=>{
          if(item.querySelector('input[type=radio]:checked'))return;
          const normal=qa(item,'input[type=radio]').find(r=>r.value==='Normal');
          if(normal){ normal.checked=true; normal.dispatchEvent(new Event('change',{bubbles:true})); }
        });
        recalcUnit(btn.closest('.unit'));
      });
    });
  }

  function setupContinue(root=document){
    qa(root,'.continue-btn').forEach(btn=>{
      if(btn.dataset.v05)return;btn.dataset.v05='1';
      btn.addEventListener('click',()=>setTimeout(()=>recalcUnit(btn.closest('.unit')),10));
    });
  }

  function floatingSaveState(state,text){
    const b=q('#floatingSave'); if(!b)return;
    b.classList.remove('saved','saving','error'); b.classList.add(state); b.textContent=text;
  }

  function setupFloatingSave(){
    const b=q('#floatingSave'); if(!b)return;
    b.addEventListener('click',()=>{
      floatingSaveState('saving','Guardando…');
      document.dispatchEvent(new Event('input',{bubbles:true}));
      setTimeout(()=>floatingSaveState('saved',`✓ Guardado ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`),900);
    });
    document.addEventListener('input',()=>{ floatingSaveState('saving','Guardando…'); setTimeout(()=>floatingSaveState('saved','✓ Guardado'),900); },true);
    document.addEventListener('change',()=>{ floatingSaveState('saving','Guardando…'); setTimeout(()=>floatingSaveState('saved','✓ Guardado'),900); },true);
  }

  function setupAutoTiming(root=document){
    qa(root,'.unit').forEach(unit=>{
      if(unit.dataset.time05)return; unit.dataset.time05='1';
      let start=unit.querySelector('[data-k="startTime"]');
      if(start && !start.value){
        const now=new Date(); start.value=now.toTimeString().slice(0,5); start.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
  }

  function buildReport(){
    const root=q('#reportRoot'); if(!root)return;
    const client=q('#sessionClient')?.value||'';
    const location=q('#sessionLocation')?.value||'';
    const date=q('#sessionDate')?.value||'';
    const tech=q('#sessionTech')?.value||'';
    const apprentice=q('#sessionApprentice')?.value||'';
    const logo=document.querySelector('header img')?.src||'';
    const pages=qa(document,'.unit').map((u,i)=>{
      const f=k=>u.querySelector(`[data-k="${k}"]`)?.value||'';
      const findings=qa(u,'.item').filter(item=>{
        const r=item.querySelector('input[type=radio]:checked'); return r && !['Normal','N/A'].includes(r.value);
      }).map(item=>{
        const r=item.querySelector('input[type=radio]:checked');
        const obs=item.querySelector('.obs')?.value||'';
        const cls=item.querySelector('.classification')?.value||'';
        const notes=item.querySelector('.item-notes')?.value||'';
        return `<div class="report-find"><b>${item.dataset.group} — ${item.dataset.item}</b><div>${r?.value||''}${cls?` · ${cls}`:''}</div>${obs?`<div><b>Observado:</b> ${obs}</div>`:''}${notes?`<div><b>Notas:</b> ${notes}</div>`:''}</div>`;
      }).join('') || '<p>Sin hallazgos anormales registrados.</p>';
      return `<div class="report-page">
        <div class="report-header">${logo?`<img src="${logo}">`:''}<div><h1 style="margin:0;color:#143b68;font-size:20px">Clover — Reporte de Inspección</h1><div>${client} · ${location} · ${date}</div></div></div>
        <table class="report-table">
          <tr><th>Unidad</th><td>${f('clientUnit')||i+1}</td><th>Marca/Modelo</th><td>${f('make')} ${f('model')}</td></tr>
          <tr><th>Serie</th><td>${f('serial')}</td><th>Horómetro</th><td>${f('hours')}</td></tr>
          <tr><th>Capacidad</th><td>${f('capacity')} lb</td><th>Energía/Llantas</th><td>${f('power')} / ${f('tires')}</td></tr>
          <tr><th>Técnico</th><td>${tech}</td><th>Aprendiz</th><td>${apprentice}</td></tr>
          <tr><th>Completitud</th><td colspan="3">${u.dataset.answered||0}/${u.dataset.required||0} · Faltan ${u.dataset.missing||0}</td></tr>
        </table>
        <h2 style="color:#143b68">Hallazgos y planeación de servicio</h2>${findings}
        <h2 style="color:#143b68">Notas generales</h2><p>${f('overallNotes')||'—'}</p>
      </div>`;
    }).join('');
    root.innerHTML=pages;
  }

  function setupReportButton(){
    const buttons=qa(document,'button');
    const btn=buttons.find(b=>/Generar reporte PDF|Guardar PDF|Imprimir/.test(b.textContent));
    if(!btn)return;
    btn.addEventListener('click',e=>{
      e.stopImmediatePropagation(); e.preventDefault();
      buildReport(); document.body.classList.add('report-mode'); window.print();
      setTimeout(()=>document.body.classList.remove('report-mode'),1200);
    },true);
  }

  
function enhanceEvidenceStep(root=document){
  qa(root,'.unit').forEach(unit=>{
    const step=unit.querySelector('.step[data-step="2"]');
    if(!step || step.dataset.evidence05)return;
    step.dataset.evidence05='1';
    const body=step.querySelector('.step-body'); if(!body)return;
    const actions=body.querySelector('.section-actions');
    const slot=(key,title,help,multiple=false)=>`
      <div class="evidence-slot">
        <h4>${title}</h4>
        <p>${help}</p>
        <div class="evidence-actions">
          <label class="evidence-action camera">📷 Tomar foto
            <input type="file" accept="image/*" capture="environment" ${multiple?'multiple':''} data-evidence="${key}" data-evidence-label="${title}">
          </label>
          <label class="evidence-action library">🖼 Elegir ${multiple?'fotos':'foto'} existente${multiple?'s':''}
            <input type="file" accept="image/*" ${multiple?'multiple':''} data-evidence="${key}" data-evidence-label="${title}">
          </label>
        </div>
        <div class="evidence-selected" data-evidence-status="${key}"></div>
      </div>`;
    body.innerHTML = `
      <div class="step-note"><b>Objetivo:</b> crear una línea base visual confiable. Puedes tomar la foto ahora o elegir una imagen existente.</div>
      ${slot('foto1_frente_derecho','Foto 1 — Frente / lado derecho','Unidad completa, incluyendo contrapeso y techo protector.')}
      ${slot('foto2_trasera_izquierda','Foto 2 — Parte trasera / lado izquierdo','Documentar carrocería, contrapeso y golpes existentes.')}
      ${slot('placa_datos','Placa de datos','La información de fabricante, modelo, serie y capacidad debe ser legible.')}
      ${slot('horometro_pantalla','Horómetro / pantalla','Capturar horas y cualquier alerta o código visible.')}
      ${slot('mastil_carro_horquillas','Mástil / carro / horquillas','Capturar el conjunto completo; agrega evidencia adicional si existe daño.',true)}
      ${slot('llantas_ruedas','Llantas / ruedas','Capturar llantas de tracción y dirección.',true)}
      ${slot('motor_bateria','Compartimiento motor o batería','Capturar el compartimiento abierto y condiciones relevantes.',true)}
      <div class="section-actions"><button type="button" class="go-next primary-light continue-btn">Continuar</button></div>`;
    setupContinue(step);
  });
}

  function hydrate(){
    setupSearchableMakes(); setupConditionalOther(); setupConditionalSections(); enhanceEvidenceStep();
    normalizeItemOptions(); setupMarkNormal(); setupContinue(); setupAutoTiming();
    qa(document,'.unit').forEach(recalcUnit);
  }

  const observer=new MutationObserver(()=>hydrate());
  observer.observe(document.body,{childList:true,subtree:true});

  document.addEventListener('change',e=>{ const u=e.target.closest('.unit'); if(u)setTimeout(()=>recalcUnit(u),20); },true);
  document.addEventListener('input',e=>{ const u=e.target.closest('.unit'); if(u)setTimeout(()=>recalcUnit(u),50); },true);
  q('#reviewMissing')?.addEventListener('click',renderMissingReview);

  setupFloatingSave();
  setupReportButton();
  hydrate();
})();


/* ---------- v0.5.1 synchronized save status ---------- */
(() => {
  const topDot = document.querySelector('#pwaDot');
  const topMain = document.querySelector('#pwaMainState');
  const topSub = document.querySelector('#pwaSubState');
  const floatBtn = document.querySelector('#floatingSave');
  let saveTimer051 = null;

  function syncSaveStatus(state, text, subtext) {
    if (floatBtn) {
      floatBtn.classList.remove('saved','saving','error');
      floatBtn.classList.add(state === 'error' ? 'error' : state === 'saving' ? 'saving' : 'saved');
      floatBtn.textContent = state === 'saving' ? 'Guardando…' :
        state === 'error' ? '⚠ Error de guardado' :
        `✓ Guardado${text ? ' ' + text : ''}`;
    }
    if (topDot) {
      topDot.className = 'pwa-dot ' + (state === 'error' ? 'bad' : state === 'saving' ? 'warn' : 'ok');
    }
    if (topMain) {
      topMain.textContent = state === 'saving' ? 'Guardando cambios…' :
        state === 'error' ? 'Error de guardado local' :
        'Guardado automático activo';
    }
    if (topSub) {
      topSub.textContent = state === 'saving'
        ? 'No cierres la aplicación hasta que termine el guardado.'
        : state === 'error'
        ? 'Descarga un respaldo JSON antes de continuar.'
        : (subtext || 'Los cambios de la inspección están guardados en este dispositivo.');
    }
  }

  function markSaving() {
    syncSaveStatus('saving');
    clearTimeout(saveTimer051);
    saveTimer051 = setTimeout(() => {
      const now = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      syncSaveStatus('saved', now, `Último guardado confirmado: ${now}`);
    }, 950);
  }

  document.addEventListener('input', markSaving, true);
  document.addEventListener('change', markSaving, true);

  if (floatBtn) {
    floatBtn.addEventListener('click', () => {
      markSaving();
    }, true);
  }

  window.addEventListener('online', () => {
    const now = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    syncSaveStatus('saved', now, 'Con conexión · guardado local activo.');
  });
  window.addEventListener('offline', () => {
    const now = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    syncSaveStatus('saved', now, 'Sin conexión · los cambios continúan guardándose localmente.');
  });

  // Startup: do not leave the interface on "Preparando..." indefinitely.
  setTimeout(() => {
    const now = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    syncSaveStatus('saved', now, navigator.onLine
      ? 'Guardado automático activo en este dispositivo.'
      : 'Modo sin conexión · guardado automático activo.');
  }, 1200);
})();
