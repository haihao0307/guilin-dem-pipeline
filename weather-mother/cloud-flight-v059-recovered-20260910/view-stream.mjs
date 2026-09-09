// Source coordinates remain untouched. Only fetch files intersecting the current view.
export function createViewStream({index,onChange,onError}) {
  const cache=new Map(),pending=new Map(),retries=new Map();
  const stats={requested:0,aborted:0,receivedBytes:0,activeTiles:0,cachedTiles:0,pending:0,detailLevel:'800 m 概览',maxConcurrent:2};
  let wanted=[],epoch=0,lastKey='',lastView=0,notifyTimer=0;
  const sha=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');
  function notify(){clearTimeout(notifyTimer);notifyTimer=setTimeout(()=>{
    const loaded=wanted.filter(t=>cache.has(t.id));stats.activeTiles=loaded.length;
    const rows=loaded.flatMap(t=>cache.get(t.id).rivers);onChange(rows);
  },80)}
  function evict(){
    const keep=new Set(wanted.map(x=>x.id));
    for(const [id] of cache)if(cache.size>24&&!keep.has(id))cache.delete(id);
    stats.cachedTiles=cache.size;
  }
  function pump(){
    const time=performance.now();
    const next=wanted.filter(t=>!cache.has(t.id)&&!pending.has(t.id)&&(retries.get(t.id)||0)<time);
    while(pending.size<2&&next.length){
      const tile=next.shift(),controller=new AbortController();pending.set(tile.id,controller);stats.requested++;
      (async()=>{
        const response=await fetch(tile.path,{signal:controller.signal});if(!response.ok)throw Error(`River tile HTTP ${response.status}`);
        const bytes=await response.arrayBuffer();if(controller.signal.aborted)return;
        if(bytes.byteLength!==tile.bytes||await sha(bytes)!==tile.sha256)throw Error('River tile hash mismatch '+tile.id);
        stats.receivedBytes+=bytes.byteLength;
        const text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
        if(controller.signal.aborted)return;const data=JSON.parse(text);
        cache.set(tile.id,data);evict();notify();
      })().catch(e=>{if(e.name!=='AbortError'){retries.set(tile.id,performance.now()+10000);onError(String(e))}}).finally(()=>{pending.delete(tile.id);stats.pending=pending.size;pump()});
    }stats.pending=pending.size;
  }
  function visible(t,S){
    const b=t.bounds,cx=(b[0]+b[2])/2,cz=(b[1]+b[3])/2;
    const range=Math.max(7000,Math.min(80000,S.r*1.3));
    if(Math.abs(cx-S.cur[0])>range+(b[2]-b[0])/2||Math.abs(cz-S.cur[1])>range+(b[3]-b[1])/2)return false;
    const m=S.viewProjection;if(!m)return true;
    const clips=[];for(const x of [b[0],b[2]])for(const y of [0,2000])for(const z of [b[1],b[3]])clips.push([m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[3]*x+m[7]*y+m[11]*z+m[15]]);
    return ![p=>p[0]<-p[2],p=>p[0]>p[2],p=>p[1]<-p[2],p=>p[1]>p[2],p=>p[2]<0].some(out=>clips.every(out));
  }
  return {stats,update(S){
    const now=performance.now();if(now-lastView<220||now-(S.lastInteraction||0)<220)return;lastView=now;
    const next=S.r>150000?[index.overview]:index.tiles.filter(t=>visible(t,S)).sort((a,b)=>{
      const d=t=>Math.hypot((t.bounds[0]+t.bounds[2])/2-S.cur[0],(t.bounds[1]+t.bounds[3])/2-S.cur[1]);return d(a)-d(b);
    }).slice(0,16);
    const key=next.map(t=>t.id).sort().join(',');if(key===lastKey){pump();return}lastKey=key;epoch++;wanted=next;
    const ids=new Set(next.map(t=>t.id));for(const [id,c] of pending)if(!ids.has(id)){c.abort();stats.aborted++;}
    stats.detailLevel=S.r>150000?'全域主河网':'当前视野完整河段';stats.visibleIds=next.map(t=>t.id);stats.epoch=epoch;
    evict();notify();pump();
  },dispose(){for(const c of pending.values())c.abort();clearTimeout(notifyTimer);cache.clear()},retry(){retries.clear();pump()}};
}
