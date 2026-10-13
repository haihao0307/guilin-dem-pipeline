// Numeric QA only: select the exact production closure, without rewriting it.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {WGSL} from '../receiver.mjs';
import {clockTowerMembers} from '../native-clock-tower.mjs';

const parts=clockTowerMembers().parts;
const railIndex=parts.findIndex(p=>p.id==='heritage-sash-rail-0-0-2');
if(railIndex<0)throw Error('Expected real heritage sash rail');
const rail=parts[railIndex],railQ=[.21,rail.shape.size[1]/2+.002,.013];
export const fixtures=[
 {name:'heritage-brick',id:1,seed:71,p:[24.42,10.011,6.962],q:[.42,10.011,2.962],extent:[2.96,13.65,2.96],sourceSeed:0,layers:[1]},
 {name:'heritage-stone',id:2,seed:171,p:[24.86,9.8,7.24],q:[.86,9.8,3.24],extent:[4.8,23,4.8],sourceSeed:0,layers:[2]},
 {name:'heritage-timber',id:4,seed:172,p:rail.shape.center.map((x,i)=>x+railQ[i]+[24,0,4][i]),q:railQ,extent:rail.shape.size.map(x=>x/2),sourceSeed:railIndex,layers:[4],sourceId:rail.id},
 {name:'heritage-hall-plaster',id:13,seed:191,p:[7.5,1.0,8.12],q:[.13,.15,.122],extent:[.2,1.5,.12],sourceSeed:0,layers:[2,13]},
 {name:'heritage-concrete',id:19,seed:173,p:[24.17,41.17,4.23],q:[.17,41.17,.23],extent:[2.7,1.3,2.7],sourceSeed:0,layers:[19]},
 {name:'control-bench-timber',id:4,seed:38,p:[-20,1.12,-13.75],q:[.21,.052,.013],extent:[1.7,.05,.055],sourceSeed:0,layers:[4]},
 {name:'control-platform-concrete',id:17,seed:77,p:[15,.852,-20],q:[.31,.577,.17],extent:[3.4,.575,67.5],sourceSeed:0,layers:[17]},
 {name:'control-shed-roof',id:3,seed:8,p:[-20,14,-25],q:[.31,.042,.17],extent:[1,1,1],sourceSeed:0,layers:[3]},
 {name:'control-waterfront-stone',id:2,seed:186,p:[60.177,-.45,4.2],q:[.377,1.2,.31],extent:[.375,1.25,100],sourceSeed:1,layers:[2]},
].map(f=>({...f,baseD:.002,normal:[0,1,0]}));
export const dimensions={width:fixtures.length,height:4};
const f=n=>Number.isInteger(n)?`${n}.`:String(n),v=a=>`vec3<f32>(${a.map(f).join(',')})`;

export function buildProbe(extraction){
 const {header,closure}=extraction(WGSL);
 const cases=fixtures.map((s,i)=>`case ${i}u:{p=${v(s.p)};normal=${v(s.normal)};h=HitField(${f(s.baseD)},${s.id}u,${v(s.q)},${f(s.seed)},${f(s.baseD)},${v(s.extent)},${f(s.sourceSeed)});}`).join('\n');
 const entry=`
@fragment fn heritageStateProbe(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{
 let index=u32(pixel.x);let row=u32(pixel.y);
 var p=vec3<f32>(0.);var normal=vec3<f32>(0.,1.,0.);
 var h=HitField(0.,0u,p,0.,0.,vec3<f32>(1.),0.);
 switch(index){${cases}\ndefault:{return vec4<f32>(-999.);}}
 let raw=resolveStationState(p);
 let geometry=evaluateStationGeometry(h,p,raw);
 let matter=evaluateStationMatter(h,p,normal,.0005);
 let state=stationMemberState(h,p,raw);
 if(row==0u){return vec4<f32>(geometry.d,matter.d,f32(matter.layer),f32(index+1u));}
 if(row==1u){return vec4<f32>(matter.surface.albedo,matter.surface.roughness);}
 if(row==2u){return vec4<f32>(matter.microHeight,geometry.loss,geometry.thickness,h.baseD);}
 return vec4<f32>(state.age,state.wet,state.repair,state.retained);
}
`;
 const selected=closure(['evaluateStationGeometry','evaluateStationMatter','stationMemberState'],entry);
 const source=header+selected+entry;
 if(source.includes('fn stationDomain(')||source.includes('fn march('))throw Error('Unexpected renderer in numeric closure');
 return {source,manifest:{scope:'Exact production geometry/matter state consistency only; no rendering or visual acceptance',ages:[0,.5,1],...dimensions,entry:'heritageStateProbe',toleranceM:1e-8,fixtures,receiverSha256:createHash('sha256').update(WGSL).digest('hex'),wgslSha256:createHash('sha256').update(source).digest('hex')}};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const moduleURL=process.env.HERITAGE_CLOSURE_MODULE?pathToFileURL(path.resolve(process.env.HERITAGE_CLOSURE_MODULE)):new URL('../../kowloon-train88-r01/shader-closure.mjs',import.meta.url);
 const {extraction}=await import(moduleURL.href),{source,manifest}=buildProbe(extraction);
 const out=fileURLToPath(new URL('./heritage-state-generated/',import.meta.url));
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'probe.wgsl'),source);fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({output:out,samples:fixtures.length*manifest.ages.length,wgslBytes:Buffer.byteLength(source),receiverSha256:manifest.receiverSha256}));
}
