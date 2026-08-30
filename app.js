(() => {
'use strict';
const VERSION='0.7', STATE_KEY='clover-inspeccion-v07-state', DB_NAME='clover-inspeccion-v07', DB_VERSION=2, MEDIA='media', STATE_STORE='state';
const MAKES=["Toyota", "Crown", "Hyster", "Yale", "Hyundai", "UniCarriers", "Nissan", "Mitsubishi", "CAT", "Clark", "Komatsu", "Doosan", "Bobcat", "Raymond", "Jungheinrich", "Linde", "Hangcha", "Heli", "TCM", "Manitou", "Baoli", "Still", "Kalmar"];
const GROUPS={"3|Seguridad": ["Freno de servicio", "Freno de estacionamiento", "Dirección / seguridad", "Claxon", "Luces", "Alarma de reversa (si está equipada)", "Asiento / sistema de retención", "Sistema de presencia / seguridad del operador", "Techo protector", "Calcomanías de seguridad", "Daño estructural evidente"], "4|Horquillas / mástil / sistema de carga": ["Desgaste / daño de horquillas", "Talón de horquillas", "Seguro de horquillas", "Condición de cadenas", "Elongación de cadenas (cuando sea práctico)", "Rodillos / rodamientos", "Carro", "Canales del mástil", "Cilindros de elevación / inclinación", "Mangueras del mástil", "Condición del aditamento", "Juego excesivo"], "5|Dirección / chasis": ["Eje de dirección", "Kingpins / articulaciones", "Cilindro de dirección", "Rodamientos de rueda", "Bastidor", "Contrapeso", "Puntos de montaje", "Evidencia de impactos"], "6|Sistema hidráulico": ["Operación de bomba", "Ruido hidráulico", "Mangueras", "Conexiones", "Cilindros", "Fugas", "Nivel de aceite hidráulico", "Condición de aceite hidráulico", "Operación elevación / inclinación / aditamento"], "7A|Tren motriz IC / LP": ["Condición general del motor", "Arranque", "Calidad de ralentí", "Humo / escape", "Fugas de motor", "Ruido anormal de motor", "Operación de transmisión", "Enganche adelante / reversa", "Indicadores de diferencial / mando final", "Sistema de enfriamiento", "Radiador", "Bandas / mangueras", "Sistema LP / combustible", "Sistema de encendido"], "7B|Sistema eléctrico / batería": ["Comportamiento motor de tracción", "Comportamiento motor hidráulico", "Controladores", "Contactores", "Cableado", "Conectores", "Códigos de error", "Ruido / calor anormal", "Condición física de batería", "Corrosión", "Cables / conectores de batería", "Condición de celdas", "Nivel / mantenimiento de agua (si aplica)", "Resultado de prueba de batería (si hay equipo)"], "8|Llantas": ["Cortes / chunking — tracción", "Desgaste irregular — tracción", "Daño — tracción", "Cortes / chunking — dirección", "Desgaste irregular — dirección", "Daño — dirección", "Condición rueda / rin", "Necesidad estimada de reemplazo"], "9|PM / mantenimiento diferido": ["Evidencia de PM vencido", "Fluidos viejos / contaminados", "Filtros descuidados", "Deficiencias de lubricación", "Fugas diferidas", "Mangueras viejas / deterioradas", "Reparaciones previas deficientes", "Reparaciones temporales", "Modificaciones no OEM"], "10|Condición general / indicadores de abuso": ["Evidencia de colisión", "Daño de operador", "Componentes doblados", "Modificaciones inusuales", "Indicadores de mal uso", "Corrosión / daño ambiental", "Reparaciones / modificaciones no autorizadas"], "11|Prueba funcional y evidencia en video": ["Arranca / energiza", "Estado de pantalla / códigos", "Traslado hacia adelante", "Traslado en reversa", "Aceleración", "Freno de servicio", "Freno de estacionamiento", "Dirección en rango completo", "Elevación", "Descenso", "Inclinación adelante / atrás", "Función hidráulica auxiliar / aditamento", "Ruido / vibración anormal", "Revisión de fugas después de operar"]};
const concerns=['Arranque','Baja potencia','Traslado / transmisión','Dirección','Frenado','Hidráulicos / mástil','Aditamento','Ruido / vibración','Fuga','Alerta / código','Llanta / rueda','Batería / autonomía','Controles / operador','Otro'];
const occurrence=['Constante','Intermitente','En frío','En caliente','Al arrancar','Bajo carga','Después de uso prolongado','Desconocido'];
let state={session:{},units:[]}, saveTimer=null, dbPromise=null;

const $=s=>document.querySelector(s), $$=(r,s)=>[...r.querySelectorAll(s)];
function uid(){return crypto.randomUUID?crypto.randomUUID():'u-'+Date.now()+'-'+Math.random().toString(36).slice(2)}
function nowTime(){return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
function setSave(kind,title,sub){
  const panel=document.querySelector('.save-panel'),dot=$('#saveDot'),t=$('#saveTitle'),s=$('#saveSub'),f=$('#floatSave');
  if(panel){panel.classList.toggle('error-state',kind==='bad');panel.classList.toggle('ok-state',kind==='ok')}
  if(dot)dot.className='dot '+(kind==='ok'?'ok':kind==='bad'?'bad':'');
  if(t)t.textContent=title;if(s)s.textContent=sub||'';
  if(f){f.className='float-save screen '+(kind==='saving'?'saving':kind==='bad'?'error':'');f.textContent=kind==='saving'?'Guardando…':kind==='bad'?'⚠ Reintentar guardar':'✓ Guardado '+nowTime()}
}
function scheduleSave(){setSave('saving','Guardando cambios…','No cierres la app hasta confirmar el guardado.');clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,500)}
function serializeDom(){
  syncStateFromDom();
  return JSON.stringify(state);
}
async function saveNow(){
  try{
    const raw=serializeDom();
    let saved=false;
    try{await idbPut(STATE_STORE,{key:'latest',raw,savedAt:new Date().toISOString()});saved=true}catch(e){console.warn('IndexedDB save failed',e)}
    try{localStorage.setItem(STATE_KEY,raw);saved=true}catch(e){console.warn('localStorage save failed',e)}
    if(!saved)throw new Error('No local storage backend available');
    setSave('ok','Guardado automático activo','Último guardado confirmado: '+nowTime());
  }catch(e){console.error(e);setSave('bad','Error de guardado local','Toca “Reintentar guardar”. Si continúa, usa el respaldo JSON.')}
}
function openDB(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(MEDIA))db.createObjectStore(MEDIA,{keyPath:'id'});
      if(!db.objectStoreNames.contains(STATE_STORE))db.createObjectStore(STATE_STORE,{keyPath:'key'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
  return dbPromise
}
async function idbPut(store,value){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function idbGet(store,key){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly');const rq=tx.objectStore(store).get(key);rq.onsuccess=()=>resolve(rq.result||null);rq.onerror=()=>reject(rq.error)})}
async function idbGetAllMedia(){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(MEDIA,'readonly');const rq=tx.objectStore(MEDIA).getAll();rq.onsuccess=()=>resolve(rq.result||[]);rq.onerror=()=>reject(rq.error)})}
async function idbDeleteMedia(id){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(MEDIA,'readwrite');tx.objectStore(MEDIA).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function saveMedia(input){
  const files=[...(input.files||[])];if(!files.length)return;
  const unit=input.closest('.unit'),unitId=unit.dataset.unitId,key=input.dataset.evidence;
  setSave('saving','Guardando evidencia…',files.length+' archivo(s).');
  try{
    for(const file of files)await idbPut(MEDIA,{id:uid(),unitId,key,name:file.name||'evidencia',type:file.type||'',size:file.size||0,createdAt:new Date().toISOString(),blob:file});
    input.value='';
    await renderMediaSlot(unit,key);
    await saveNow();updateAll(unit);
  }catch(e){console.error(e);setSave('bad','Error guardando evidencia','La información escrita sigue disponible; intenta agregar la foto nuevamente.')}
}
async function restoreMediaPreviews(unit){
  try{const all=await idbGetAllMedia();const keys=[...new Set(all.filter(r=>r.unitId===unit.dataset.unitId).map(r=>r.key))];for(const key of keys)await renderMediaSlot(unit,key);updateAll(unit)}catch(e){console.warn(e)}
}
async function renderMediaSlot(unit,key){
  const grid=unit.querySelector('[data-preview="'+CSS.escape(key)+'"]');if(!grid)return;
  const all=(await idbGetAllMedia()).filter(r=>r.unitId===unit.dataset.unitId&&r.key===key);
  grid.innerHTML='';
  for(const rec of all){
    const card=document.createElement('div');card.className='photo-preview';
    const url=rec.type.startsWith('image/')?URL.createObjectURL(rec.blob):'';
    card.innerHTML=(url?`<img src="${url}" alt="">`:`<div class="file-meta">🎥 ${rec.name}</div>`)+`<button type="button" class="delete-media">×</button><div class="file-meta">${rec.name}</div>`;
    card.querySelector('.delete-media').onclick=async()=>{if(confirm('¿Eliminar esta evidencia?')){await idbDeleteMedia(rec.id);if(url)URL.revokeObjectURL(url);await renderMediaSlot(unit,key);updateAll(unit);scheduleSave()}};
    grid.appendChild(card);
  }
}
function sessionFromDom(){return{client:$('#client').value,location:$('#location').value,tech:$('#tech').value,date:$('#date').value,notes:$('#sessionNotes').value}}
function unitFromDom(unit){
 const fields={}; $$(unit,'[data-k]').forEach(el=>fields[el.dataset.k]=el.value);
 const concernsVals=$$(unit,'.concerns input:checked').map(x=>x.value),occVals=$$(unit,'.occurrence input:checked').map(x=>x.value);
 const checks=$$(unit,'.item').map(i=>{const r=i.querySelector('input[type=radio]:checked');return{group:i.dataset.group,item:i.dataset.item,status:r?r.value:'',observation:i.querySelector('.obs')?.value||'',classification:i.querySelector('.classification')?.value||'',notes:i.querySelector('.notes')?.value||'',unableReason:i.querySelector('.unableReason')?.value||''}});
 return{id:unit.dataset.unitId,fields,concerns:concernsVals,occurrence:occVals,checks};
}
function syncStateFromDom(){state.session=sessionFromDom();state.units=$$('#units .unit').map(unitFromDom)}
function applyState(){
 $('#client').value=state.session.client||'';$('#location').value=state.session.location||'';$('#tech').value=state.session.tech||'';$('#date').value=state.session.date||new Date().toISOString().slice(0,10);$('#sessionNotes').value=state.session.notes||'';
 $('#units').innerHTML=''; if(!state.units.length)addUnit(); else state.units.forEach(u=>addUnit(u)); renderDashboard();renderMissing();
}
function createChip(name,value,label,checked=false){return`<label class="chip"><input type="checkbox" name="${name}" value="${value}" ${checked?'checked':''}><span>${label}</span></label>`}
function createRadio(name,value,label){return`<label class="chip"><input type="radio" name="${name}" value="${value}"><span>${label}</span></label>`}
function createItem(group,item,index){
 const n='r-'+uid();
 return`<div class="item" data-group="${group}" data-item="${item}"><div class="item-name">${item}</div><div class="quick">${['Normal','Monitor','Reparar','Preocupación mayor','N/A','No inspeccionado','No se pudo inspeccionar'].map(v=>createRadio(n,v,v)).join('')}</div><div class="detail"><div class="grid2"><div><label>Observación / medición</label><input class="obs"></div><div><label>Clasificación</label><select class="classification"><option value="">Seleccionar</option><option>Reparación inmediata / línea base</option><option>Rehabilitación inicial recomendada</option><option>Monitorear</option><option>Componente mayor / evaluación separada</option><option>Evaluar reparar vs reemplazar</option></select></div></div><label>Notas</label><textarea class="notes"></textarea><label>Motivo si no se pudo inspeccionar</label><select class="unableReason"><option value="">Seleccionar</option><option>Unidad no operable</option><option>Acceso no disponible</option><option>Herramienta requerida</option><option>Restricción del cliente</option><option>Otro</option></select><div class="evidence-slot"><h4>Evidencia del hallazgo</h4><label class="ev-label single">📷 Agregar foto o video (cámara o biblioteca)<input type="file" accept="image/*,video/*" data-evidence="finding-${index}"></label><div class="photo-preview-grid" data-preview="finding-${index}"></div></div></div></div>`
}
function buildDynamicSteps(unit){
 const host=unit.querySelector('.dynamicSteps');host.innerHTML='';
 Object.entries(GROUPS).forEach(([key,items])=>{
  const [num,title]=key.split('|'); const isIC=num==='7A',isE=num==='7B';
  const d=document.createElement('details');d.className='step'+(isIC?' ic-step':'')+(isE?' electric-step hidden':'');d.dataset.step=num;d.innerHTML=`<summary><span class="num">${num.replace(/[AB]/,'')}</span><span><span class="step-title">${title}</span><span class="step-status">0/${items.length}</span></span></summary><div class="step-body"><div class="itemList">${items.map((it,i)=>createItem(title,it,num+'-'+i)).join('')}</div><button type="button" class="mark-normal">✓ Marcar pendientes como Normal</button><button type="button" class="continue">Continuar</button></div>`;host.appendChild(d);
 });
}
function buildEvidence(unit){
 const a=unit.querySelector('.evidenceArea');
 const slot=(key,title,help,multi=false)=>`<div class="evidence-slot"><h4>${title}</h4><p>${help}</p><label class="ev-label single">📷 Agregar ${multi?'fotos':'foto'} (cámara o biblioteca)<input type="file" accept="image/*" ${multi?'multiple':''} data-evidence="${key}"></label><div class="photo-preview-grid" data-preview="${key}"></div></div>`;
 a.innerHTML=`<div class="small"><b>Objetivo:</b> crear una línea base visual confiable. En iPhone el botón permite tomar foto, usar la biblioteca o elegir archivo.</div>${slot('foto1','Foto 1 — Frente / lado derecho','Unidad completa, incluyendo contrapeso y techo protector.')}${slot('foto2','Foto 2 — Parte trasera / lado izquierdo','Documentar carrocería, contrapeso y golpes existentes.')}${slot('placa','Placa de datos','La información debe ser legible.')}${slot('horometro','Horómetro / pantalla','Capturar horas y alertas visibles.')}${slot('mastil','Mástil / carro / horquillas','Capturar el conjunto completo.',true)}${slot('llantas','Llantas / ruedas','Capturar tracción y dirección.',true)}${slot('motor','Compartimiento motor o batería','Capturar el compartimiento abierto.',true)}<button type="button" class="continue">Continuar</button>`;
}
function addUnit(data=null){
 const frag=$('#unitTemplate').content.cloneNode(true),unit=frag.querySelector('.unit');unit.dataset.unitId=data?.id||uid();$('#units').appendChild(unit);buildDynamicSteps(unit);buildEvidence(unit);
 unit.querySelector('.concerns').innerHTML=concerns.map(v=>createChip('c-'+unit.dataset.unitId,v,v,data?.concerns?.includes(v))).join('');
 unit.querySelector('.occurrence').innerHTML=occurrence.map(v=>createChip('o-'+unit.dataset.unitId,v,v,data?.occurrence?.includes(v))).join('');
 if(data){Object.entries(data.fields||{}).forEach(([k,v])=>{const el=unit.querySelector('[data-k="'+k+'"]');if(el)el.value=v});(data.checks||[]).forEach(c=>{const item=$$(unit,'.item').find(i=>i.dataset.group===c.group&&i.dataset.item===c.item);if(!item)return;const r=$$(item,'input[type=radio]').find(x=>x.value===c.status);if(r)r.checked=true; if(item.querySelector('.obs'))item.querySelector('.obs').value=c.observation||'';if(item.querySelector('.classification'))item.querySelector('.classification').value=c.classification||'';if(item.querySelector('.notes'))item.querySelector('.notes').value=c.notes||'';if(item.querySelector('.unableReason'))item.querySelector('.unableReason').value=c.unableReason||''})}
 if(!unit.querySelector('[data-k="startTime"]').value)unit.querySelector('[data-k="startTime"]').value=new Date().toTimeString().slice(0,5);
 bindUnit(unit);renumber();updateAll(unit);restoreMediaPreviews(unit);return unit
}
function bindUnit(unit){
 unit.querySelector('.remove').addEventListener('click',()=>{if(confirm('¿Eliminar esta unidad?')){unit.remove();renumber();scheduleSave();renderDashboard();renderMissing()}});
 unit.addEventListener('input',e=>{if(e.target.classList.contains('makeSearch'))showMakeSuggestions(e.target);scheduleSave();updateAll(unit)},true);
 unit.addEventListener('change',e=>{if(e.target.type==='file')saveMedia(e.target);if(e.target.matches('input[type=radio]')){const item=e.target.closest('.item');item.classList.toggle('abnormal',!['Normal','N/A','No inspeccionado'].includes(e.target.value));item.classList.toggle('unable',e.target.value==='No se pudo inspeccionar')}conditional(unit);scheduleSave();updateAll(unit)},true);
 unit.addEventListener('click',e=>{if(e.target.classList.contains('continue')){const step=e.target.closest('.step');step.open=false;const steps=$$(unit,'.step').filter(s=>!s.classList.contains('hidden'));const idx=steps.indexOf(step);if(steps[idx+1]){steps[idx+1].open=true;steps[idx+1].scrollIntoView({behavior:'smooth',block:'start'})}updateAll(unit)} if(e.target.classList.contains('mark-normal')){const step=e.target.closest('.step');$$(step,'.item').forEach(i=>{if(i.querySelector('input[type=radio]:checked'))return;const r=$$(i,'input[type=radio]').find(x=>x.value==='Normal');if(r)r.checked=true});scheduleSave();updateAll(unit)}},true);
 conditional(unit);syncCapacityToggle(unit);setupSearch(unit)
}
function setupSearch(unit){const inp=unit.querySelector('.makeSearch'),box=inp.parentElement.querySelector('.suggest');inp.addEventListener('focus',()=>showMakeSuggestions(inp));inp.addEventListener('blur',()=>setTimeout(()=>box.classList.add('hidden'),180))}
function showMakeSuggestions(inp){const box=inp.parentElement.querySelector('.suggest'),v=inp.value.trim().toLowerCase();if(!v){box.classList.add('hidden');return}const matches=MAKES.filter(m=>m.toLowerCase().includes(v)).slice(0,8);box.innerHTML=matches.map(m=>`<button type="button">${m}</button>`).join('')+'<button type="button">Otra / no listada</button>';box.classList.remove('hidden');$$(box,'button').forEach(b=>b.onclick=()=>{inp.value=b.textContent.startsWith('Otra')?'':b.textContent;box.classList.add('hidden');inp.dispatchEvent(new Event('change',{bubbles:true}))})}
function conditional(unit){
 const power=unit.querySelector('[data-k="power"]').value;
 unit.querySelector('.electric-step').classList.toggle('hidden',power!=='Eléctrico');
 unit.querySelector('.ic-step').classList.toggle('hidden',power==='Eléctrico');
 [['mast','mastOther'],['attachment','attachmentOther'],['forkLength','forkLengthOther']].forEach(([a,b])=>unit.querySelector('[data-k="'+b+'"]').classList.toggle('hidden',unit.querySelector('[data-k="'+a+'"]').value!=='Otro'));
 const attachment=unit.querySelector('[data-k="attachment"]').value;
 const forkEligible=['Ninguno','Desplazador lateral','Posicionador de horquillas','Push/Pull','Multiple load handler'];
 unit.querySelector('.fork-length-wrap').classList.toggle('hidden',!forkEligible.includes(attachment));
}
function syncCapacityToggle(unit){
 const v=unit.querySelector('[data-k="capacityUnit"]')?.value||'lb';
 $$(unit,'[data-capacity-toggle] button').forEach(b=>b.classList.toggle('active',b.dataset.unit===v));
}
function renumber(){$$('#units .unit').forEach((u,i)=>u.querySelector('.unitIndex').textContent=i+1)}
function stepMetrics(step){
 const items=$$(step,'.item');if(items.length){const done=items.filter(i=>i.querySelector('input[type=radio]:checked')).length;return{done,total:items.length}}
 if(step.dataset.step==='2'){const st=$$(step,'[data-preview]');return{done:st.filter(x=>x.children.length>0).length,total:st.length}}
 const fields=$$(step,'[data-k]').filter(el=>!el.classList.contains('hidden')&&!['mastOther','attachmentOther','forkLengthOther','operatorNotes','overallNotes','missingTools','finishTime','capacityUnit'].includes(el.dataset.k));return{done:fields.filter(el=>String(el.value||'').trim()).length,total:fields.length}
}
function updateAll(unit){
 const checks=$$(unit,'.item'),findings=checks.filter(i=>{const r=i.querySelector('input[type=radio]:checked');return r&&!['Normal','N/A','No inspeccionado'].includes(r.value)}).length;unit.querySelector('.findingBadge').textContent='Hallazgos: '+findings;
 let done=0,total=0;$$(unit,'.step').filter(s=>!s.classList.contains('hidden')).forEach(s=>{const m=stepMetrics(s);done+=m.done;total+=m.total;s.querySelector('.step-status').textContent=m.done+'/'+m.total+(m.done===m.total?' · Completo':' · Faltan '+(m.total-m.done))});
 unit.querySelector('.completeBadge').textContent=done+'/'+total;unit.dataset.done=done;unit.dataset.total=total;unit.dataset.missing=total-done;
 const f=k=>unit.querySelector('[data-k="'+k+'"]')?.value||'';unit.querySelector('.unitSubtitle').textContent=[f('clientUnit'),f('make'),f('model')].filter(Boolean).join(' · ')||'Unidad nueva';
 renderFindings(unit);renderDashboard();renderMissing()
}
function renderFindings(unit){const box=unit.querySelector('.findingsSummary'),items=$$(unit,'.item').filter(i=>{const r=i.querySelector('input[type=radio]:checked');return r&&!['Normal','N/A','No inspeccionado'].includes(r.value)});box.innerHTML=items.length?items.map(i=>{const r=i.querySelector('input[type=radio]:checked'),o=i.querySelector('.obs')?.value||'',c=i.querySelector('.classification')?.value||'';return`<div class="item"><b>${i.dataset.group} — ${i.dataset.item}</b><div>${r.value}${c?' · '+c:''}</div>${o?'<div class="small">Observado: '+escapeHtml(o)+'</div>':''}</div>`}).join(''):'<div class="small">Sin hallazgos anormales registrados.</div>'}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m])}
function renderDashboard(){const box=$('#unitDashboard'),units=$$('#units .unit');box.innerHTML=units.map((u,i)=>`<button class="unit-nav" type="button" data-i="${i}"><b>Montacargas ${i+1} — ${u.querySelector('.unitSubtitle').textContent}</b><div class="small">${u.dataset.done||0}/${u.dataset.total||0} · ${u.dataset.missing==='0'?'Completa':'Faltan '+u.dataset.missing}</div></button>`).join('');$$(box,'.unit-nav').forEach(b=>b.onclick=()=>units[Number(b.dataset.i)].scrollIntoView({behavior:'smooth',block:'start'}))}
function missingForStep(step){const items=$$(step,'.item');if(items.length)return items.filter(i=>!i.querySelector('input[type=radio]:checked')).map(i=>i.dataset.item);if(step.dataset.step==='2')return $$(step,'[data-preview]').filter(x=>x.children.length===0).map(x=>x.dataset.preview||'Evidencia');const arr=[];$$(step,'[data-k]').filter(el=>!el.classList.contains('hidden')&&!['mastOther','attachmentOther','forkLengthOther','operatorNotes','overallNotes','missingTools','finishTime','capacityUnit'].includes(el.dataset.k)).forEach(el=>{if(!String(el.value||'').trim())arr.push(el.closest('div')?.querySelector('label')?.textContent||el.dataset.k)});return arr}
function renderMissing(){const groups=[],units=$$('#units .unit');let total=0;units.forEach((u,ui)=>$$(u,'.step').filter(s=>!s.classList.contains('hidden')).forEach(s=>{const m=missingForStep(s);if(m.length){total+=m.length;groups.push({u,ui,s,m,title:s.querySelector('.step-title').textContent})}}));$('#missingSummary').textContent=total?'Faltan '+total+' respuestas/evidencias.':'✓ No se detectan faltantes.';$('#missingGroups').innerHTML=groups.map((g,i)=>`<div class="missing-group"><b>Montacargas ${g.ui+1} · ${g.title}</b><div class="small">${g.m.slice(0,5).join(' · ')}${g.m.length>5?'…':''}</div><button class="jump" type="button" data-i="${i}">Ir a esta sección (${g.m.length})</button></div>`).join('');$$('#missingGroups .jump').forEach(b=>b.onclick=()=>{const g=groups[Number(b.dataset.i)];g.s.open=true;g.s.scrollIntoView({behavior:'smooth',block:'start'})})}
async function shareOrDownload(name,text,type){
 const blob=new Blob([text],{type}),file=new File([blob],name,{type});
 try{if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:name});return true}}catch(e){if(e.name!=='AbortError')console.warn(e)}
 try{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return true}catch(e){console.error(e);return false}
}
async function backup(){await saveNow();const ok=await shareOrDownload('clover-inspeccion-'+($('#date').value||'sesion')+'.json',JSON.stringify(state,null,2),'application/json');$('#bottomActionStatus').textContent=ok?'Respaldo listo para guardar/compartir.':'No se pudo generar el respaldo.'}
async function exportCSV(){
  syncStateFromDom();
  const rows=[['Unidad','Marca','Modelo','Grupo','Ítem','Estado','Observación','Clasificación','Notas']];
  state.units.forEach(u=>(u.checks||[]).filter(c=>c.status&&!['Normal','N/A','No inspeccionado'].includes(c.status)).forEach(c=>rows.push([u.fields.clientUnit||'',u.fields.make||'',u.fields.model||'',c.group,c.item,c.status,c.observation,c.classification,c.notes])));
  const csv=rows.map(r=>r.map(v=>'\"'+String(v||'').replace(/\"/g,'\"\"')+'\"').join(',')).join('\n');
  const ok=await shareOrDownload('clover-hallazgos.csv',csv,'text/csv');
  $('#bottomActionStatus').textContent=ok?'CSV listo para guardar/compartir.':'No se pudo generar el CSV.';
}
function report(){syncStateFromDom();const root=$('#reportRoot');root.innerHTML=state.units.map((u,i)=>{const f=u.fields||{},fs=(u.checks||[]).filter(c=>c.status&&!['Normal','N/A','No inspeccionado'].includes(c.status));return`<div class="report-page"><div class="report-head"><img src="./icon-192.png"><div><h1 style="margin:0;color:#17497d;font-size:20px">Clover — Reporte de Inspección</h1><div>${escapeHtml(state.session.client||'')} · ${escapeHtml(state.session.location||'')} · ${escapeHtml(state.session.date||'')}</div></div></div><table class="report-table"><tr><th>Unidad</th><td>${escapeHtml(f.clientUnit||String(i+1))}</td><th>Marca / Modelo</th><td>${escapeHtml((f.make||'')+' '+(f.model||''))}</td></tr><tr><th>Serie</th><td>${escapeHtml(f.serial||'')}</td><th>Horómetro</th><td>${escapeHtml(f.hours||'')}</td></tr><tr><th>Capacidad</th><td>${escapeHtml(f.capacity||'')} ${escapeHtml(f.capacityUnit||'lb')}</td><th>Energía / llantas</th><td>${escapeHtml((f.power||'')+' / '+(f.tires||''))}</td></tr></table><h2 style="color:#17497d">Hallazgos</h2>${fs.length?fs.map(c=>`<div class="report-find"><b>${escapeHtml(c.group)} — ${escapeHtml(c.item)}</b><div>${escapeHtml(c.status)}${c.classification?' · '+escapeHtml(c.classification):''}</div>${c.observation?'<div><b>Observado:</b> '+escapeHtml(c.observation)+'</div>':''}${c.notes?'<div><b>Notas:</b> '+escapeHtml(c.notes)+'</div>':''}</div>`).join(''):'<p>Sin hallazgos anormales registrados.</p>'}<h2 style="color:#17497d">Notas generales</h2><p>${escapeHtml(f.overallNotes||'—')}</p></div>`}).join('');$('#bottomActionStatus').textContent='Abriendo impresión / guardar PDF…';setTimeout(()=>window.print(),100)}
async function load(){
 try{
   let raw=null;
   try{const rec=await idbGet(STATE_STORE,'latest');raw=rec?.raw||null}catch(e){console.warn(e)}
   if(!raw)try{raw=localStorage.getItem(STATE_KEY)}catch(e){console.warn(e)}
   if(raw)state=JSON.parse(raw);
 }catch(e){console.error(e)}
 if(!state.session)state.session={};if(!Array.isArray(state.units))state.units=[];
 applyState();setSave('ok','Guardado automático activo','Último guardado confirmado: '+nowTime());
}
function bindGlobal(){
 ['client','location','tech','date','sessionNotes'].forEach(id=>$('#'+id).addEventListener('input',scheduleSave));
 $('#addUnit').onclick=()=>{addUnit();scheduleSave();renderDashboard();renderMissing()};
 $('#backupBtn').onclick=backup;$('#findingsCsvBtn').onclick=exportCSV;$('#pdfBtn').onclick=report;$('#floatSave').onclick=saveNow;
 $('#clearBtn').onclick=()=>{if(confirm('¿Borrar toda la sesión local?')){try{localStorage.removeItem(STATE_KEY)}catch(e){};state={session:{},units:[]};applyState();saveNow()}};
 $('#importBtn').onclick=()=>$('#importFile').click();$('#importFile').onchange=async()=>{const f=$('#importFile').files[0];if(!f)return;try{state=JSON.parse(await f.text());applyState();await saveNow();alert('Respaldo importado.')}catch(e){alert('No se pudo importar el respaldo.')}};
 $('#persistBtn').onclick=async()=>{if(navigator.storage?.persist){const ok=await navigator.storage.persist();alert(ok?'Almacenamiento persistente solicitado correctamente.':'El navegador no garantizó almacenamiento persistente. Descarga respaldos periódicos.')}else alert('Este navegador no ofrece esta función.')};
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveNow()});
 window.addEventListener('pagehide',saveNow)
}
bindGlobal();load();
})();
if('serviceWorker' in navigator && location.protocol.startsWith('http')){navigator.serviceWorker.register('./sw.js').catch(console.error);}
