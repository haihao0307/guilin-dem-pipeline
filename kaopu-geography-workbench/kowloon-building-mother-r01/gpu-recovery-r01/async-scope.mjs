export function interruption(message='GPU work interrupted'){const error=new Error(message);error.name='AbortError';return error;}
// The rejection is prompt, and late resolution cannot commit into a later epoch.
export class GenerationScope {
 constructor(){this.generation=1;this.pending=new Set();}
 token(){return this.generation;}
 assert(token){if(token!==this.generation)throw interruption('Stale asynchronous field operation');}
 wrap(promise,token=this.token()){
  try{this.assert(token);}catch(error){return Promise.reject(error);}
  return new Promise((resolve,reject)=>{const entry={reject};this.pending.add(entry);Promise.resolve(promise).then(value=>{this.pending.delete(entry);try{this.assert(token);resolve(value);}catch(error){reject(error);}},error=>{this.pending.delete(entry);reject(error);});});
 }
 invalidate(reason){this.generation++;for(const entry of this.pending)entry.reject(interruption(reason));this.pending.clear();}
}
