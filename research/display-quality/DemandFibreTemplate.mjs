import {shortFibre} from './SourceFibres.mjs';
import {buildFullFibreTemplate} from './FullFibreTemplate.mjs';
const scratchFloat=new Float32Array(1),scratchBits=new Uint32Array(scratchFloat.buffer);const outward=(x,up)=>{const a=scratchFloat,u=scratchBits;a[0]=x;if((up&&a[0]<x)||(!up&&a[0]>x))u[0]+=((a[0]>=0)===up)?1:-1;return a[0];};
export function buildDemandFibreTemplate(profile,mmPerPixel,samples=48,{startRank=0}={}){
 if(!Number.isInteger(samples)||samples<1||samples>960||!Number.isInteger(startRank)||startRank<0||startRank>=samples)throw Error('Valid original root interval required');
 if(samples===960&&startRank===0){const b=buildFullFibreTemplate(profile,mmPerPixel);return{...b,originalIDs:Uint32Array.from({length:b.count},(_,i)=>i),samplesPerNeedle:960,startRank:0,endRank:960};}
 const segmentCount=samples-startRank,started=performance.now(),count=profile.grid[0]*profile.grid[1]*segmentCount,records=new Float32Array(count*28),ids=new Uint32Array(count),bounds=new Float32Array(count*6),low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity],shift=[-profile.grid[0]*profile.pitchMM*.5,-profile.grid[1]*profile.pitchMM*.25,0];let at=0;
 for(let row=0;row<profile.grid[1];row++)for(let col=0;col<profile.grid[0];col++)for(let rank=startRank;rank<samples;rank++){
  const j=rank*577%960,f=shortFibre(col,row,j,profile,mmPerPixel);ids[at]=(row*profile.grid[0]+col)*960+j;f.root=f.root.map((v,k)=>v+shift[k]);
  const lo=f.root.map((v,k)=>outward(v+Math.min(0,f.strand[k])+Math.min(0,f.bend[k])-Math.abs(f.curl[k])-f.radiusMM,false)),hi=f.root.map((v,k)=>outward(v+Math.max(0,f.strand[k])+Math.max(0,f.bend[k])+Math.abs(f.curl[k])+f.radiusMM,true));
  records.set([...f.root,f.radiusMM,...f.strand,f.wave,...f.bend,1,...f.curl,col,row,f.seed,f.near,f.colourVariation,...f.normal,0,j,0,0,0],at*28);bounds.set([...lo,...hi],at*6);for(let k=0;k<3;k++){low[k]=Math.min(low[k],lo[k]);high[k]=Math.max(high[k],hi[k]);}at++;
 }
 const codes=new Uint32Array(count),order=Uint32Array.from({length:count},(_,i)=>i),spread=x=>{x&=1023;x=(x|(x<<16))&0x030000ff;x=(x|(x<<8))&0x0300f00f;x=(x|(x<<4))&0x030c30c3;x=(x|(x<<2))&0x09249249;return x;};
 for(let i=0;i<count;i++){const p=[0,1,2].map(k=>Math.max(0,Math.min(1023,Math.floor(((bounds[i*6+k]+bounds[i*6+k+3])*.5-low[k])/(high[k]-low[k])*1023))));codes[i]=(spread(p[0])|(spread(p[1])<<1)|(spread(p[2])<<2))>>>0;}
 let src=order,dst=new Uint32Array(count);for(let pass=0;pass<4;pass++){const sizes=new Uint32Array(256),offsets=new Uint32Array(256),bit=pass*8;for(let i=0;i<count;i++)sizes[(codes[src[i]]>>>bit)&255]++;for(let i=1;i<256;i++)offsets[i]=offsets[i-1]+sizes[i-1];for(let i=0;i<count;i++){const id=src[i];dst[offsets[(codes[id]>>>bit)&255]++]=id;}[src,dst]=[dst,src];}
 const leafCount=Math.ceil(count/8),nodeCount=leafCount*2-1,nodes=new Float32Array(nodeCount*8);let cursor=0;
 const build=(first,last)=>{const index=cursor++;if(last-first===1){const start=first*8,end=Math.min(count,start+8),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=start;i<end;i++)for(let k=0;k<3;k++){const id=src[i];lo[k]=Math.min(lo[k],bounds[id*6+k]);hi[k]=Math.max(hi[k],bounds[id*6+k+3]);}nodes.set([...lo,start+1,...hi,cursor],index*8);return index;}const middle=Math.floor((first+last)/2),a=build(first,middle),b=build(middle,last);for(let k=0;k<3;k++){nodes[index*8+k]=Math.min(nodes[a*8+k],nodes[b*8+k]);nodes[index*8+4+k]=Math.max(nodes[a*8+4+k],nodes[b*8+4+k]);}nodes[index*8+7]=cursor;return index;};build(0,leafCount);
 return{records,originalIDs:ids,order:src,nodes,bounds:{low,high},count,nodeCount,mmPerPixel,samplesPerNeedle:segmentCount,startRank,endRank:samples,stats:{fullPopulation:false,sourceFibresPerNeedle:960,samplesPerNeedle:segmentCount,sourceRankRange:[startRank,samples],fibres:count,loadedFraction:segmentCount/960,nodeCount,leafSize:8,cacheBytes:records.byteLength+src.byteLength+nodes.byteLength,buildMs:performance.now()-started,noFibreSampling:false,sourceFunctionsUnchanged:true,deterministicNestedIds:true}};
}
export function packDemandFibreRecords(built){
 const data=new Float32Array(built.count*20),src=built.records;for(let i=0;i<built.count;i++){const id=built.order[i],at=id*28,to=i*20;for(let k=0;k<8;k++)data[to+k]=src[at+k];for(let k=0;k<3;k++){data[to+8+k]=src[at+8+k];data[to+12+k]=src[at+12+k];data[to+16+k]=src[at+20+k];}data[to+11]=src[at+18];data[to+15]=src[at+19];data[to+19]=built.originalIDs[id];}
 return{data,stride:20,savedBytes:src.byteLength-data.byteLength,morton:true};
}
