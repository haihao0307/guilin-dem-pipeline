import {outwardTriangleNormal} from './sphere-normal-kernel.mjs';
import {sinPi8,cosPi8} from './rivet-spheres.mjs';
export function parseAttributeRule(input){
  const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
  if(new TextDecoder().decode(b.subarray(0,8))!=='M3ATTR01')throw Error('Invalid attribute pack');
  const n=v.getUint32(8,true),meta=JSON.parse(new TextDecoder().decode(b.subarray(12,12+n))),data=b.subarray(12+n);
  const sections=Object.fromEntries(Object.entries(meta.sections).map(([key,item])=>[key,data.subarray(item.offset,item.offset+item.bytes)]));
  return {meta,sections};
}
const bit=(b,i)=>(b[i>>>3]>>>(i&7))&1;
const u16=(b,i)=>b[2*i]+b[2*i+1]*256;
function facetNormals(){
  const point=(t,l)=>{const r=sinPi8(t);return[r*sinPi8(l),cosPi8(t),-r*cosPi8(l)];};
  const result=new Float32Array(128*3);let out=0;
  for(let lat=0;lat<8;lat++)for(let lon=0;lon<16;lon++){
    let a,b,c;
    if(lat===0){a=point(0,0);b=point(1,lon);c=point(1,lon+1);}
    else{a=point(lat,lon);b=point(lat+1,lon);c=point(lat,lon+1);}
    const n=outwardTriangleNormal(a,b,c);
    for(const x of n)result[out++]=Math.fround(x);
  }
  return result;
}
export function generateAttributeBaseline(meta,s){
  const {kind,components,samples}=meta;
  if(kind==='sphere_uv'||kind==='torus_uv'){
    const output=new Float32Array(components*samples*2);let branch=0,pole=0,out=0;
    for(let component=0;component<components;component++)for(let vertex=0;vertex<samples;vertex++){
      let u,v;
      if(kind==='sphere_uv'){
        const label=s.geometryLabels[vertex],lat=label>>>4,lon=label&15;
        u=.75-lon/16;if(u<0)u+=1;
        if(lat===0||lat===8)u=s.poleAddresses[pole++]/32;
        if(lon===12)u=bit(s.seamBranches,branch++);
        v=1-lat/8;
      }else{
        const label=u16(s.geometryLabels,vertex),theta=Math.floor(label/12),phi=label%12;
        u=.5-theta/48;if(u<0)u+=1;v=.5+phi/12;if(v>=1)v-=1;
        if(theta===24)u=bit(s.seamBranches,branch++)?1:2**-50;
        if(phi===6)v=bit(s.seamBranches,branch++)?1:2**-52;
      }
      output[out++]=Math.fround(u);output[out++]=Math.fround(v);
    }
    if(branch!==meta.seamBranchCount)throw Error('Seam branch count mismatch');
    return output;
  }
  if(kind==='sphere_facet_normals'){
    const normals=facetNormals(),output=new Float32Array(components*samples*3);let override=0,out=0;
    for(let component=0;component<components;component++)for(let vertex=0;vertex<samples;vertex++){
      const i=component*samples+vertex;
      const face=bit(s.faceOverrideMask,i)?s.faceOverrideValues[override++]:s.faceBase[vertex];
      output[out++]=normals[face*3];output[out++]=normals[face*3+1];
      output[out++]=component>=28?-normals[face*3+2]:normals[face*3+2];
    }
    return output;
  }
  if(kind==='topology_templates'){
    const output=new Uint32Array(meta.scalarCount);let out=0,start=0;
    for(const count of meta.phaseTriangleCounts){
      for(let component=0;component<components;component++){
        const variant=components===56?Math.floor(component/28):Math.floor(component/24)*2+Math.floor((component%24)/12);
        for(let triangle=start;triangle<start+count;triangle++)for(let corner=0;corner<3;corner++){
          const i=(variant*meta.trianglesPerComponent+triangle)*3+corner;
          output[out++]=u16(s.topologyTemplates,i)+component*samples;
        }
      }
      start+=count;
    }
    if(out!==meta.scalarCount)throw Error('Topology output count mismatch');
    return output;
  }
  throw Error(`Unknown attribute rule ${kind}`);
}
export function decodeAttributeRule(input){
  const {meta,sections:s}=parseAttributeRule(input),output=generateAttributeBaseline(meta,s);
  const bits=new Uint32Array(output.buffer);
  if(meta.correctionEncoding==='dense_int16_bit_delta'){
    for(let i=0;i<bits.length;i++){let d=u16(s.bitCorrections,i);if(d>=32768)d-=65536;bits[i]+=d;}
  }else if(meta.correctionEncoding==='sparse_int8_bit_or_index_delta'){
    let residual=0;
    for(let i=0;i<bits.length;i++)if(bit(s.correctionMask,i)){
      let d=s.correctionValues[residual++];if(d>=128)d-=256;bits[i]+=d;
    }
    if(residual!==s.correctionValues.length)throw Error('Attribute residual count mismatch');
  }
  return output;
}
