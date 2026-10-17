/** True longitudinal sweep of an explicitly retained free-form 2D profile.
 * This does not claim the contour or the unmodeled deviations are analytic.
 */
const STEPS=[0,3,4,7,8,11,12,15];
export function parseRoofSweep(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(new TextDecoder().decode(b.subarray(0,8))!=='M3ROOF01')throw Error('Bad roof sweep magic');
 const count=v.getUint32(8,true),np=v.getUint16(12,true),nparams=v.getUint16(14,true),corrections=v.getUint32(16,true);
 if(np!==31||nparams!==14)throw Error('Invalid roof profile');
 let at=20;const profile=Array.from({length:np},(_,j)=>[v.getFloat32(at+j*8,true),v.getFloat32(at+j*8+4,true)]);at+=np*8;
 const ribs=Array.from(b.subarray(at,at+np));at+=np;
 const params=Array.from({length:14},(_,i)=>v.getFloat64(at+i*8,true));at+=112;
 const labels=Array.from({length:count},(_,i)=>v.getUint16(at+i*2,true));at+=count*2;
 const mask=b.subarray(at,at+Math.ceil(count*3/8));at+=mask.length;
 const deltas=new Int8Array(b.buffer,b.byteOffset+at,corrections);at+=corrections;
 if(at!==b.length)throw Error('Invalid roof rule length');
 return {count,profile,ribs,params,labels,mask,deltas};
}
export function generateRoofSweep({count,profile,ribs,params:p,labels}){
 const out=new Float32Array(count*3);
 for(let vi=0;vi<count;vi++){
  const label=labels[vi],j=label&31,station=(label>>5)&15;
  if(j>=31)throw Error('Bad roof profile address');
  let [x,y]=profile[j];const rib=Boolean(ribs[j]);
  if(station===15&&rib)y=y-p[13];
  let z=station===0?0:station<=8?p[0]+p[1]*STEPS[station-1]:p[station-7];
  if(station>=1&&station<=10){
   const width=Math.min(Math.max(p[10]-x,0),p[10]-p[11]);
   const scale=(1+p[9]*width)-(rib&&x>0?p[12]:0);z=z*scale;
  }
  out[vi*3]=(label&512)?-x:x;out[vi*3+1]=y;out[vi*3+2]=(label&1024)?-z:z;
 }
 return out;
}
export function decodeRoofSweep(input,{applyCorrections=true}={}){
 const rule=parseRoofSweep(input),out=generateRoofSweep(rule),bits=new Uint32Array(out.buffer);let k=0;
 for(let i=0;i<bits.length;i++)if((rule.mask[i>>3]>>(i&7))&1){
  if(applyCorrections)bits[i]+=rule.deltas[k];k++;
 }
 if(k!==rule.deltas.length)throw Error('Roof residual count mismatch');
 return out;
}
