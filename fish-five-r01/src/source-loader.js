// Decode and parse original source samples away from the drawing thread.
// The score's pixels, indices and measured surface values remain unchanged.
const workerMain = () => {
  const floatFields=['positions','normals','uvs','finWeight','finGradient'];
  self.onmessage=async ({data:{id,payload}})=>{try{
    const binary=atob(payload.trim()),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    const text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    const score=JSON.parse(text),transfer=[];
    for(const p of score.primitives){
      // Float32 is the same upload precision used by the existing renderer.
      for(const key of floatFields)if(p[key]){p[key]=Float32Array.from(p[key]);transfer.push(p[key].buffer);}
      for(const key of ['paramAddress','residual'])if(p[key]){p[key]=Float64Array.from(p[key]);transfer.push(p[key].buffer);}
      for(const key of ['indices','finId'])if(p[key]){p[key]=Uint32Array.from(p[key]);transfer.push(p[key].buffer);}
    }
    self.postMessage({id,score},transfer);
  }catch(error){self.postMessage({id,error:String(error.message||error)});}};
};
export function createSourceLoader(){
  const url=URL.createObjectURL(new Blob(['('+workerMain.toString()+')()'],{type:'text/javascript'}));
  const worker=new Worker(url),pending=new Map(),cache=new Map();URL.revokeObjectURL(url);
  worker.onmessage=({data})=>{const job=pending.get(data.id);if(!job)return;pending.delete(data.id);if(data.error){cache.delete(data.id);job.reject(Error(data.error));}else job.resolve(data.score);};
  worker.onerror=event=>{for(const job of pending.values())job.reject(Error(event.message));pending.clear();cache.clear();};
  return {load(id){if(cache.has(id))return cache.get(id);const el=document.getElementById('score-'+id);if(!el)return Promise.reject(Error('缺少原表面数据 '+id));const result=new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));cache.set(id,result);worker.postMessage({id,payload:el.textContent});return result;},dispose(){worker.terminate();cache.clear();pending.clear();}};
}
