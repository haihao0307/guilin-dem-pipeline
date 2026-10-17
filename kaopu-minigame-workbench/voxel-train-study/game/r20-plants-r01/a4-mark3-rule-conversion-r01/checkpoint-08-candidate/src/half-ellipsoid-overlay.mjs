/** Sparse exact affine half-ellipsoid overlay. No retained source-coordinate table. */
import {sphereOffset} from './sphere-kernel.mjs';
const bytes=x=>x instanceof Uint8Array?x:new Uint8Array(x);
export function canonical(cid,radialScale=1,axialScale=1){
 if(!Number.isInteger(cid)||cid<0||cid>=65)throw Error('Invalid half-ellipsoid address');
 const k=cid===0?0:1+Math.floor((cid-1)/16),j=cid===0?0:(cid-1)%16;
 const [sx,sy,sz]=sphereOffset(1,k,j,16,8);return [sz*radialScale,sx*radialScale,sy*axialScale];
}
export function sampleAffine(a,cid,radialScale=1,axialScale=1){const[x,y,z]=canonical(cid,radialScale,axialScale);return [0,1,2].map(k=>((x*a[k]+y*a[3+k])+z*a[6+k])+a[9+k]);}
export function parseRaw(input){
 const data=bytes(input);if(data.length<28||new TextDecoder().decode(data.subarray(0,8))!=='A4HELL01')throw Error('Invalid half-ellipsoid overlay');
 const dv=new DataView(data.buffer,data.byteOffset,data.byteLength),field=dv.getUint32(8,true),vertices=dv.getUint32(12,true),seeds=dv.getUint16(16,true),bindings=dv.getUint16(18,true),corrections=dv.getUint32(20,true),flags=dv.getUint32(24,true);
 if(flags!==0||!(seeds>0&&seeds<=255)||!(bindings>0&&bindings<=vertices&&vertices<=65535)||corrections>seeds*195)throw Error('Invalid half-ellipsoid header');
 if(data.length!==28+seeds*96+bindings*4+corrections*3)throw Error('Half-ellipsoid payload length mismatch');
 let off=28;const params=[];for(let s=0;s<seeds;s++){const a=[];for(let k=0;k<12;k++){a.push(dv.getFloat64(off,true));off+=8;}if(!a.every(Number.isFinite))throw Error('Nonfinite affine parameters');params.push(a);}
 const targets=[],seen=new Set();for(let i=0;i<bindings;i++){const row=dv.getUint16(off,true),tag=dv.getUint16(off+2,true);off+=4;if(row>=vertices||seen.has(row)||tag>=seeds*130)throw Error('Invalid half-ellipsoid binding');seen.add(row);targets.push([row,tag]);}
 const fixes=[],seenFixes=new Set();for(let i=0;i<corrections;i++){const scalar=dv.getUint16(off,true),delta=dv.getInt8(off+2);off+=3;if(scalar>=seeds*195||seenFixes.has(scalar)||delta===0)throw Error('Invalid half-ellipsoid correction');seenFixes.add(scalar);fixes.push([scalar,delta]);}
 if(off!==data.length)throw Error('Trailing half-ellipsoid payload bytes');return {field,vertices,params,targets,fixes};
}
export function decodeRaw(input,{radialScale=1,axialScale=1,translation=[0,0,0],applyCorrections=true}={}){
 if(!Number.isFinite(radialScale)||radialScale<=0||!Number.isFinite(axialScale)||axialScale<=0||translation.length!==3||!translation.every(Number.isFinite))throw Error('Invalid half-ellipsoid variation');
 const {field,vertices,params,targets,fixes}=parseRaw(input),points=new Float32Array(params.length*195),bits=new Uint32Array(points.buffer);
 for(let s=0;s<params.length;s++)for(let cid=0;cid<65;cid++){const p=sampleAffine(params[s],cid,radialScale,axialScale);if(!p.every(Number.isFinite))throw Error('Nonfinite half-ellipsoid sample');points.set(p,s*195+cid*3);}
 const useCorrections=applyCorrections&&radialScale===1&&axialScale===1&&translation.every(x=>x===0);
 if(useCorrections)for(const[i,delta]of fixes)bits[i]=(bits[i]+delta)>>>0;
 const ids=new Uint32Array(targets.length),positions=new Float32Array(targets.length*3),out=new Uint32Array(positions.buffer),translate=translation.some(x=>x!==0);
 for(let i=0;i<targets.length;i++){const[row,tag]=targets[i],seed=Math.floor(tag/130),rem=tag%130,mirror=Math.floor(rem/65),cid=rem%65,at=seed*195+cid*3;ids[i]=row;for(let k=0;k<3;k++)out[i*3+k]=bits[at+k];if(mirror)out[i*3]^=0x80000000;if(translate)for(let k=0;k<3;k++)positions[i*3+k]+=translation[k];}
 return {field,sourceVertexCount:vertices,vertexIndices:ids,ids,positions};
}
