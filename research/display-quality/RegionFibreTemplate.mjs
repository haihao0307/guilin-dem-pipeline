import {shortFibre} from './SourceFibres.mjs';
import {packDemandFibreRecords} from './DemandFibreTemplate.mjs';
import {fibreCullingBounds} from './FibreOptimization.mjs';
import {tightenFibreHierarchy} from './TightFibreHierarchy.mjs';
const f32=new Float32Array(1),bits=new Uint32Array(f32.buffer);
const outward=(x,up)=>{f32[0]=x;if((up&&f32[0]<x)||(!up&&f32[0]>x))bits[0]+=((f32[0]>=0)===up)?1:-1;return f32[0];};

// Rebuild only the given source-needle range. IDs and fibre formulas match
// the whole template; Morton order and hierarchy are disposable indices.
export function buildRegionFibreTemplate(profile,mmPerPixel,samples,region){
 const {col0,col1,row0,row1}=region||{},[cols,rows]=profile.grid;
 if(![col0,col1,row0,row1,samples].every(Number.isInteger)||col0<0||row0<0||col1>cols||row1>rows||col0>=col1||row0>=row1||samples<1||samples>960||!Number.isFinite(mmPerPixel)||mmPerPixel<=0)throw Error('Invalid source fibre region');
 const started=performance.now(),count=(col1-col0)*(row1-row0)*samples,records=new Float32Array(count*28),ids=new Uint32Array(count),bounds=new Float32Array(count*6),low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity],shift=[-cols*profile.pitchMM*.5,-rows*profile.pitchMM*.25,0];let at=0;
 for(let row=row0;row<row1;row++)for(let col=col0;col<col1;col++)for(let rank=0;rank<samples;rank++){
  const j=samples===960?rank:rank*577%960,f=shortFibre(col,row,j,profile,mmPerPixel);ids[at]=(row*cols+col)*960+j;f.root=f.root.map((v,k)=>v+shift[k]);
  const lo=f.root.map((v,k)=>outward(v+Math.min(0,f.strand[k])+Math.min(0,f.bend[k])-Math.abs(f.curl[k])-f.radiusMM,false)),hi=f.root.map((v,k)=>outward(v+Math.max(0,f.strand[k])+Math.max(0,f.bend[k])+Math.abs(f.curl[k])+f.radiusMM,true));
  records.set([...f.root,f.radiusMM,...f.strand,f.wave,...f.bend,1,...f.curl,col,row,f.seed,f.near,f.colourVariation,...f.normal,0,j,0,0,0],at*28);bounds.set([...lo,...hi],at*6);for(let k=0;k<3;k++){low[k]=Math.min(low[k],lo[k]);high[k]=Math.max(high[k],hi[k]);}at++;
 }
 const codes=new Uint32Array(count),order=Uint32Array.from({length:count},(_,i)=>i),spread=x=>{x&=1023;x=(x|(x<<16))&0x030000ff;x=(x|(x<<8))&0x0300f00f;x=(x|(x<<4))&0x030c30c3;x=(x|(x<<2))&0x09249249;return x;};
 for(let i=0;i<count;i++){const p=[0,1,2].map(k=>Math.max(0,Math.min(1023,Math.floor(((bounds[i*6+k]+bounds[i*6+k+3])*.5-low[k])/(high[k]-low[k])*1023))));codes[i]=(spread(p[0])|(spread(p[1])<<1)|(spread(p[2])<<2))>>>0;}
 let src=order,dst=new Uint32Array(count);for(let pass=0;pass<4;pass++){const sizes=new Uint32Array(256),offsets=new Uint32Array(256),bit=pass*8;for(let i=0;i<count;i++)sizes[(codes[src[i]]>>>bit)&255]++;for(let i=1;i<256;i++)offsets[i]=offsets[i-1]+sizes[i-1];for(let i=0;i<count;i++){const id=src[i];dst[offsets[(codes[id]>>>bit)&255]++]=id;}[src,dst]=[dst,src];}
 const leafCount=Math.ceil(count/8),nodeCount=leafCount*2-1,nodes=new Float32Array(nodeCount*8);let cursor=0;
 const build=(first,last)=>{const index=cursor++;if(last-first===1){const start=first*8,end=Math.min(count,start+8),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=start;i<end;i++)for(let k=0;k<3;k++){const id=src[i];lo[k]=Math.min(lo[k],bounds[id*6+k]);hi[k]=Math.max(hi[k],bounds[id*6+k+3]);}nodes.set([...lo,start+1,...hi,cursor],index*8);return index;}const middle=Math.floor((first+last)/2),a=build(first,middle),b=build(middle,last);for(let k=0;k<3;k++){nodes[index*8+k]=Math.min(nodes[a*8+k],nodes[b*8+k]);nodes[index*8+4+k]=Math.max(nodes[a*8+4+k],nodes[b*8+4+k]);}nodes[index*8+7]=cursor;return index;};build(0,leafCount);
 return{records,originalIDs:ids,order:src,nodes,bounds:{low,high},count,nodeCount,mmPerPixel,stats:{region:{col0,col1,row0,row1},fullPopulation:samples===960,sourceFibresPerNeedle:960,samplesPerNeedle:samples,fibres:count,nodeCount,leafSize:8,cacheBytes:records.byteLength+src.byteLength+nodes.byteLength,buildMs:performance.now()-started,sourceFunctionsUnchanged:true}};
}

// Packing is independent of camera and instance. It can run in the worker
// before upload; no geometry, source IDs, iteration or optical data change.
export function prepareRegionFibreGpu(raw,samples){
 const built=samples===960?raw:tightenFibreHierarchy(raw),packed=packDemandFibreRecords(built),rootBounds=fibreCullingBounds(packed.data,20);
 let maximumFibreAabbDiameter=0;
 for(let i=0;i<built.count;i++){const id=packed.data[i*20+19];rootBounds[i*8+3]=((id%960)*193)%960;maximumFibreAabbDiameter=Math.max(maximumFibreAabbDiameter,Math.hypot(rootBounds[i*8+4]-rootBounds[i*8],rootBounds[i*8+5]-rootBounds[i*8+1],rootBounds[i*8+6]-rootBounds[i*8+2]));}
 return{gpuPacked:true,packedData:packed.data,rootBounds,nodes:built.nodes,bounds:built.bounds,count:built.count,nodeCount:built.nodeCount,maximumFibreAabbDiameter,allNearZero:built.records.every((v,i)=>i%28!==18||v===0),stats:built.stats};
}
