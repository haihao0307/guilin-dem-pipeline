// Exact original kind-2 GLSL compared with its WGSL port on the actual GPU.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import{createHash}from'node:crypto';
import {WGSL}from'../receiver.mjs';
const root=fileURLToPath(new URL('./',import.meta.url));
const source=fs.readFileSync(path.join(root,'granite-original-reference.glsl'),'utf8');
const points=Array.from({length:32},(_,i)=>i<24?[-.031+(i%6)*.00817,-.016+Math.floor(i/6)*.00631,.0031+(i%5)*.00137]:[.86+(i-24)*.00037,9.8+(i-24)*.00051,3.24+(i-24)*.00023]);
const footprints=[.00025,.0005,.002,.008,.016,.04];
const f=x=>Number.isInteger(x)?x+'.':String(x),v=(a,type='vec3<f32>')=>type+'('+a.map(f).join(',')+')';
const getPoint='fn point(index:u32)->vec3<f32>{switch(index){'+points.map((p,i)=>`case ${i}u:{return ${v(p)};}`).join('')+'default:{return vec3<f32>(0.);}}}';
const entry=`${getPoint}\n@fragment fn graniteProbe(@builtin(position) pixel:vec4<f32>)->@location(0)vec4<f32>{
 let p=point(u32(pixel.x));let row=u32(pixel.y);let n=vec3<f32>(0.,0.,1.);
 let original=kpGraniteOriginalSurface(p,.13,-.01);
 if(row==0u){return vec4<f32>(original.albedo,original.roughness);}
 if(row==1u){return vec4<f32>(original.height,kpGraniteHeight(p),0.,1.);}
 let age=.64;let wet=.08;let repair=.38;let retained=age*(1.-repair);
 let sw=wet*(.45+.55*retained)*(1.-.45*repair);let rb=.07*retained+.025*.15-.06*repair;
 let expected=kpGraniteOriginalSurface(p,sw,rb);let zero=kpGraniteSurface(p,n,age,wet,repair,0.);
 if(row==2u){return vec4<f32>(zero.albedo,zero.roughness);}
 if(row==3u){let delta=abs(zero.albedo-expected.albedo);return vec4<f32>(zero.height,expected.height,max(delta.x,max(delta.y,delta.z)),abs(zero.roughness-expected.roughness));}
 let fp=array<f32,6>(${footprints.map(f).join(',')});
 if(row<10u){let s=kpGraniteSurface(p,n,age,wet,repair,fp[row-4u]);return vec4<f32>(s.albedo,s.roughness);}
 let shifted=p+vec3<f32>(.0002,0.,0.);let s=kpGraniteSurface(shifted,n,age,wet,repair,select(.04,.00025,row==11u));return vec4<f32>(s.albedo,s.roughness);
}`;
const moduleURL=process.env.HERITAGE_CLOSURE_MODULE?pathToFileURL(path.resolve(process.env.HERITAGE_CLOSURE_MODULE)):new URL('../../kowloon-train88-r01/shader-closure.mjs',import.meta.url);const {extraction}=await import(moduleURL.href);const{header,closure}=extraction(WGSL);const wgsl=header+closure(['kpGraniteOriginalSurface','kpGraniteHeight','kpGraniteSurface'],entry)+entry;
const glPoint='vec3 point(int index){switch(index){'+points.map((p,i)=>`case ${i}:return ${v(p,'vec3')};`).join('')+'default:return vec3(0.);}}';
const reference='#version 300 es\nprecision highp float;precision highp int;\n'+source+'\n'+glPoint+'\nout vec4 fragColor;void main(){StoneSample s=stoneFields(point(int(gl_FragCoord.x))/.026);if(int(gl_FragCoord.y)==0)fragColor=vec4(s.color,s.rough);else fragColor=vec4(s.height*.026,0.,0.,1.);}\n';
const out=path.join(root,'granite-probe-generated');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'probe.wgsl'),wgsl);fs.writeFileSync(path.join(out,'reference.frag'),reference);
const manifest={scope:'actual GPU original kind2 point fidelity, geometry height and explicit footprint responses; not a scene/image acceptance',width:32,height:12,referenceHeight:2,points,footprints,parameters:{sourceWet:.13,roughBias:-.01,age:.64,wet:.08,repair:.38,sourceScale:1,mineral:.7,chroma:1,relief:1,scaleM:.026,colorSeed:8632,poreSeed:8538,weatherSeed:8832},hashes:{source: createHash('sha256').update(source).digest('hex'),wgsl:createHash('sha256').update(wgsl).digest('hex'),reference:createHash('sha256').update(reference).digest('hex')}};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({samples:32,rows:12,bytes:Buffer.byteLength(wgsl),hashes:manifest.hashes}));
