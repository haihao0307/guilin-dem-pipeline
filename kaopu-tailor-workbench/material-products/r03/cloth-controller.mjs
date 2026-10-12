export class ClothController{
 constructor({onFrame,onError,onProgress}){this.worker=new Worker(new URL('./cloth-worker.mjs',import.meta.url),{type:'module'});this.sequence=0;this.pending=new Map();this.running=false;this.dead=false;this.onFrame=onFrame;this.onError=onError;this.onProgress=onProgress;this.rows=[];this.worker.onmessage=({data:d})=>{if(this.dead)return;const task=this.pending.get(d.id);if(d.progress!==undefined){this.onProgress?.(d.progress);return;}if(!task)return;this.pending.delete(d.id);if(d.error){this.running=false;task.reject(Error(d.error));return;}this.rows=d.rows;this.onFrame?.(d.rows);task.resolve(d.rows);};this.worker.onerror=e=>{this.running=false;for(const task of this.pending.values())task.reject(Error(e.message));this.pending.clear();onError?.(Error(e.message));};}
 command(command,data={}){if(this.dead)return Promise.reject(Error('Disposed cloth controller'));const id=++this.sequence;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({id,command,...data});});}
 async init(rows,lock,settings){return this.command('init',{rows,lock,settings});}
 play(){if(this.running||this.dead)return;this.running=true;const next=async()=>{if(!this.running||this.dead)return;try{await this.command('step');if(this.running)setTimeout(next,10);}catch(e){this.running=false;this.onError?.(e);}};void next();}
 pause(){this.running=false;}
 async settle(seconds=.5){this.pause();return this.command('settle',{seconds});}
 async tug(){this.pause();await this.command('tug');this.play();}
 async reset(){this.pause();return this.command('reset');}
 async set(settings){return this.command('settings',{settings});}
 dispose(){this.dead=true;this.running=false;this.worker.terminate();for(const task of this.pending.values())task.reject(new DOMException('Superseded','AbortError'));this.pending.clear();}
}
