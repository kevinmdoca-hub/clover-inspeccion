// App adapter around the immutable shared Settings presentation release.
export function attachSharedSettings({open,identity,assert,window=globalThis.window}){
 const previous=window.CloverSettings,priorAction=window.CloverSharedDeviceSettings;
 const action=()=>{assert();previous?.close?.();open();};
 const api=Object.freeze({open:action});window.CloverSharedDeviceSettings=api;
 let wrapper;
 if(previous?.open){wrapper=Object.freeze({...previous,open(adapter){assert();return previous.open({...adapter,read:()=>{const value=adapter.read?.()||{};return {...value,user:value.user||identity(),deviceConfigured:true};},actions:{...adapter.actions,changeDevice:action,resetDevice:action}});}});window.CloverSettings=wrapper;}
 const click=event=>{const path=event.composedPath();if(!path.some(el=>el?.tagName==='CLOVER-SETTINGS-PANEL'))return;const button=path.find(el=>['device','resetDevice'].includes(el?.dataset?.action));if(!button)return;event.preventDefault();event.stopImmediatePropagation();action();};
 window.addEventListener('click',click,true);
 return ()=>{window.removeEventListener('click',click,true);if(window.CloverSettings===wrapper)window.CloverSettings=previous;if(window.CloverSharedDeviceSettings===api){if(priorAction)window.CloverSharedDeviceSettings=priorAction;else delete window.CloverSharedDeviceSettings;}};
}
