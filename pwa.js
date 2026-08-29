(() => {
  'use strict';

  const VERSION = 'v0.4';
  const STATE_KEY = 'clover-baseline-es-v04';
  const DB_NAME = 'clover-inspeccion-pwa-v04';
  const DB_VERSION = 1;
  const STATE_STORE = 'state';
  const MEDIA_STORE = 'media';

  const $ = s => document.querySelector(s);
  const $$ = (root, s) => [...root.querySelectorAll(s)];
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
    ensureUnitIds();
    wireEvents();
    wireInstall();
    wireImport();
    await recoverFromSecondaryStore();
    await registerSW();
    await countMedia();
    await showStorageEstimate();
    await mirrorStateNow();
    if (navigator.storage?.persisted) {
      try {
        const persisted = await navigator.storage.persisted();
        if (persisted) setStatus('ok', navigator.onLine ? 'Guardado automático activo' : 'Modo sin conexión', 'Almacenamiento persistente confirmado.');
      } catch (e) {}
    }
  }

  init();
})();
