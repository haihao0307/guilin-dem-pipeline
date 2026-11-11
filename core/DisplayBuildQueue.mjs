// Provider-neutral off-thread preparation. Results stay disposable caches.
export class DisplayBuildQueue{
 constructor(workerURL){this.worker=new Worker(workerURL,{type:'module'});this.pending=new Map();this.next=1;this.disposed=false;this.worker.onmessage=({data})=>{const p=this.pending.get(data.id);if(!p)return;this.pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);};this.worker.onerror=e=>{for(const p of this.pending.values())p.reject(Error(e.message));this.pending.clear();};}
 build(payload){if(this.disposed)return Promise.reject(Error('Disposed display build queue'));const id=this.next++;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({id,payload});});}
 dispose(){if(this.disposed)return;this.disposed=true;this.worker.terminate();for(const p of this.pending.values())p.reject(Error('Display preparation cancelled'));this.pending.clear();}
}
