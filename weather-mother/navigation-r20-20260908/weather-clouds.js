/** Embed the R20 artistic cloud module. No physical weather or meter scale is implied. */
export async function mountClouds(container,options={}){
 if(!(container instanceof Element))throw new TypeError('A container element is required');
 const scene=options.scene??'silver';if(!['silver','sea'].includes(scene))throw new TypeError('Unknown cloud scene');
 const url=new URL(options.url??'./index.html',import.meta.url);url.searchParams.set('embed','1');url.searchParams.set('scene',scene);
 if(!['https:','http:'].includes(url.protocol))throw new TypeError('Cloud URL must use HTTPS or HTTP');
 const iframe=document.createElement('iframe');iframe.title='Weather Mother R20 云景';iframe.style.cssText='width:100%;height:100%;border:0;display:block';
 const channel='weather-clouds/v1',pending=new Map();let serial=0,destroyed=false;
 function receive(event){const m=event.data;if(event.source!==iframe.contentWindow||event.origin!==url.origin||!m||m.channel!==channel||m.type!=='response')return;const entry=pending.get(m.id);if(!entry)return;clearTimeout(entry.timer);pending.delete(m.id);m.ok?entry.resolve(m.value):entry.reject(new Error(m.error));}
 window.addEventListener('message',receive);
 function request(method,args,timeout=15000){if(destroyed)return Promise.reject(new Error('Cloud module was destroyed'));const id=String(++serial);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Cloud request timed out: '+method));},timeout);pending.set(id,{resolve,reject,timer});iframe.contentWindow.postMessage({channel,type:'request',id,method,args},url.origin);});}
 function destroy(){if(destroyed)return;destroyed=true;window.removeEventListener('message',receive);for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(new Error('Cloud module was destroyed'));}pending.clear();iframe.remove();}
 const loaded=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Cloud page load timed out')),60000);iframe.addEventListener('load',()=>{clearTimeout(timer);resolve();},{once:true});iframe.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Cloud page load failed'));},{once:true});});
 iframe.src=url.href;container.append(iframe);
 try{await loaded;const initial=await request('connect',{controls:options.controls!==false},65000);
  return {iframe,initial,getState:()=>request('getState'),setScene:scene=>request('setScene',scene),setCamera:camera=>request('setCamera',camera),setEnvironment:environment=>request('setEnvironment',environment),restoreSnapshot:snapshot=>request('restoreSnapshot',snapshot),reset:()=>request('reset'),suspend:value=>request('suspend',value),focus:()=>iframe.focus(),destroy};
 }catch(error){destroy();throw error;}
}
