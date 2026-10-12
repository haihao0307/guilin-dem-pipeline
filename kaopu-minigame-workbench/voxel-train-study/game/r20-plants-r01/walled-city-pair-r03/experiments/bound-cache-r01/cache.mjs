// CPU binary32 replay used only to assess a shared distance cache. No production
// renderer, geometry, mother, camera or GPU pipeline is modified by this module.
const f=Math.fround,add=(a,b)=>f(f(a)+f(b)),sub=(a,b)=>f(f(a)-f(b)),mul=(a,b)=>f(f(a)*f(b));
const bitView=new DataView(new ArrayBuffer(4));export function f32bits(x){bitView.setFloat32(0,x,true);return bitView.getUint32(0,true);}
export function boxBound(point,row){
 const [cx,base,width,height,front,rear]=row;const halfW=mul(width,.5),halfH=mul(height,.5),mid=mul(add(front,rear),.5),depth=mul(sub(rear,front),.5);
 const center=[cx,add(base,halfH),mid],half=[add(halfW,.9),add(halfH,.18),add(depth,1)];
 const q=point.map((v,i)=>sub(Math.abs(sub(v,center[i])),half[i]));const a=q.map(v=>Math.max(v,0));
 return add(f(Math.sqrt(add(add(mul(a[0],a[0]),mul(a[1],a[1])),mul(a[2],a[2])))),Math.min(Math.max(q[0],Math.max(q[1],q[2])),0));
}
export function branch(bound,currentDistance){if(bound>add(currentDistance,.024))return'skip';return bound>f(.22)?'proxy':'detail';}
export class SharedBoundCache{
 constructor(rows){this.rows=rows;this.keys=null;this.generation=null;this.bounds=new Float32Array(rows.length);this.counters={distanceEvaluations:0,cacheHits:0,cacheMisses:0,reads:0};}
 invalidate(){this.keys=null;this.generation=null;}
 query(point,generation){if(!Number.isSafeInteger(generation)||generation<1||generation>0xffffffff)throw Error('explicit nonzero world generation required');if(point.length!==3||point.some(x=>!Number.isFinite(x)))throw Error('finite metre point required');const key=point.map(f32bits);if(this.generation===generation&&key.every((x,i)=>x===this.keys[i])){this.counters.cacheHits++;return this.bounds;}this.keys=key;this.generation=generation;this.counters.cacheMisses++;for(let s=0;s<this.rows.length;s++){this.bounds[s]=boxBound(point,this.rows[s]);this.counters.distanceEvaluations++;}return this.bounds;}
 get(point,generation,storey){this.counters.reads++;return this.query(point,generation)[storey];}
}
// A complete original-order scan still performs all threshold/competition tests.
// Caller supplies the actual per-floor detail leaf; the cache does not replace it.
export function scanGroup({point,rows,maximum,excluded,detail,cached,generation=1,counters}){
 let winner={d:f(maximum),key:'initial',kind:'initial'};
 for(let s=0;s<rows.length;s++){
  const bound=cached?cached.get(point,generation,s):boxBound(point,rows[s]);if(!cached)counters.distanceEvaluations++;
  counters.thresholdChecks++;const step=branch(bound,winner.d);if(step==='skip')continue;
  const candidate=step==='proxy'?{d:sub(bound,.06),key:s+':proxy',kind:'proxy'}:detail(s,point);
  if(step==='detail')counters.detailInvocations++;
  if(candidate.d<winner.d&&!excluded.has(candidate.key))winner=candidate;
 }
 return winner;
}
export const CACHE_GPU_COST={contexts:1024,floors:27,boundFloatBytes:1024*27*4,keyBytes:1024*4*4,totalExtraBytes:126976,thresholdScansRemoved:false};
