// Finite-domain numeric regression. Production WGSL expressions stay unchanged.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {WGSL} from '../receiver.mjs';
import {clockTowerMembers,clockTowerWGSL} from '../native-clock-tower.mjs';
import {clockTowerMembers as loopMembers,clockTowerWGSL as loopWGSL} from './heritage-timber-loop-candidate.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
function fn(source,name){const start=source.indexOf('fn '+name+'(');assert(start>=0,'Missing '+name);const open=source.indexOf('{',start);let depth=1,end=open+1;for(;depth&&end<source.length;end++){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;}assert.equal(depth,0);return source.slice(start,end);}
export function sampleDomain(){
 const construction=clockTowerMembers(),parts=construction.parts;assert.deepEqual(loopMembers(),construction);
 const timber=parts.map((part,member)=>({part,member})).filter(({part})=>part.surface.role==='window-timber');assert.equal(timber.length,144);
 const samples=[],counts={};
 const add=(kind,p,sourceId,member=null)=>{assert(p.every(Number.isFinite));samples.push({tag:samples.length+1,kind,p,sourceId,member});counts[kind]=(counts[kind]||0)+1;};
 for(const {part,member} of timber){
  const half=part.shape.size.map(x=>x/2);
  for(const x of [-1,0,1])for(const y of [-1,0,1])for(const z of [-1,0,1]){
   const direction=[x,y,z],axes=direction.filter(Boolean).length;if(!axes)continue;const length=Math.hypot(...direction),kind=['','face','edge','corner'][axes];
   for(const delta of [-.0002,0,.0002])add(kind,part.shape.center.map((c,i)=>c+direction[i]*(half[i]+delta/length)),part.id,member);
  }
  // Additional samples straddle the shared 30.01mm prune envelope and 45mm
  // near/far closure boundary; these are inputs, not substitute material math.
  const axis=part.shape.size.indexOf(Math.min(...part.shape.size));
  for(const delta of [.02999,.03001,.03003,.04499,.04501])add('distance-boundary',part.shape.center.map((c,i)=>c+(i===axis?half[i]+delta:0)),part.id,member);
 }
 for(const part of parts.filter(p=>/^heritage-window-(jamb|head|sill|pediment-base)-/.test(p.id)&&p.shape.type==='box')){
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1])add('stone-adjacency',part.shape.center.map((c,i)=>c+(i===axis?sign*part.shape.size[i]/2:0)),part.id);
 }
 for(let face=0;face<4;face++)for(const [level,win]of construction.windows.entries()){
  const angle=face*Math.PI/2;
  for(const u of [-.745,0,.745])for(const y of [-win.h/2,0,win.h/2])for(const delta of [-.0002,0,.0002]){
   const depth=6.2/2-.26+delta;
   add('window-aperture',[Math.cos(angle)*u+Math.sin(angle)*depth,win.y+y,-Math.sin(angle)*u+Math.cos(angle)*depth],`window-${face}-${level}`);
  }
 }
 return {samples,counts,timberMembers:timber.map(({part,member})=>({sourceId:part.id,member}))};
}
export function buildProbe(extraction){
 const referenceShader=clockTowerWGSL(),candidateShader=loopWGSL(),reference=fn(referenceShader,'completeTowerTimber'),candidate=fn(candidateShader,'completeTowerTimber');
 assert.equal(referenceShader.replace(reference,''),candidateShader.replace(candidate,''),'Changes outside timber emitter');
 const first=reference.indexOf('q=(p-'),last=reference.lastIndexOf('h.d=h.baseD;return h;');
 assert(first>0&&last>first);const prefix=reference.slice(0,first),body=reference.slice(first,last),tail=reference.slice(last);
 const statements=body.split('\n').filter(Boolean);assert.equal(statements.length,144);
 assert(statements.every(s=>s.includes('child.d=stationCandidatePhysicalDistance(child,world,st)')));
 assert.equal(statements.join('\n')+'\n',body,'Original statement text and order');
 const chunks=Array.from({length:16},(_,i)=>statements.slice(i*9,(i+1)*9).join('\n')+'\n');
 assert.equal(prefix+chunks.join('')+tail,reference,'Exact 16-slice reconstruction of original function');
 const renamedCandidate=candidate.replace('fn completeTowerTimber(', 'fn heritageTimberCandidate(');
 const domain=sampleDomain(),width=128,inputHeight=Math.ceil(domain.samples.length/width),programs=[];
 for(let index=0;index<17;index++){
  const isCandidate=index===16,final=isCandidate||index===15,name=isCandidate?'candidate':'reference-'+index;
  const slice=isCandidate?renamedCandidate:'fn heritageTimberReferenceSlice(p:vec3<f32>,previous:HitField)->HitField{var h=previous;var q=vec3<f32>(0.);var d=0.;let world=p+vec3<f32>(24.,0.,4.);let st=resolveStationState(world);\n'+chunks[index]+'return h;}';
  const {header,closure}=extraction(WGSL+'\n'+slice);
  const initial=index===0?'var h=HitField(1e5,4u,sample.xyz,172.,1e5,vec3<f32>(1.),0.);':`let a=textureLoad(heritageCarryA,vec2<i32>(pixel.xy),0);let b=textureLoad(heritageCarryB,vec2<i32>(pixel.xy),0);let c=textureLoad(heritageCarryC,vec2<i32>(pixel.xy),0);var h=HitField(a.x,u32(a.y),b.xyz,a.z,a.w,c.xyz,b.w);`;
  const entry=`
@group(0)@binding(1)var heritageTimberPoints:texture_2d<f32>;
${!isCandidate&&index>0?'@group(0)@binding(2)var heritageCarryA:texture_2d<f32>;\n@group(0)@binding(3)var heritageCarryB:texture_2d<f32>;\n@group(0)@binding(4)var heritageCarryC:texture_2d<f32>;':''}
struct HeritageTimberResult{@location(0)scalarFields:vec4<f32>,@location(1)coordinatesAndWinner:vec4<f32>,@location(2)extentAndPhysical:vec4<f32>,@location(3)inputPointAndTag:vec4<f32>,}
@fragment fn heritageTimberProbe(@builtin(position)pixel:vec4<f32>)->HeritageTimberResult{
 let sample=textureLoad(heritageTimberPoints,vec2<i32>(pixel.xy),0);var out:HeritageTimberResult;
 if(sample.w==0.){out.scalarFields=vec4<f32>(0.);out.coordinatesAndWinner=vec4<f32>(0.);out.extentAndPhysical=vec4<f32>(0.);out.inputPointAndTag=sample;return out;}
 ${isCandidate?'var h=heritageTimberCandidate(sample.xyz);':initial+'h=heritageTimberReferenceSlice(sample.xyz,h);'}
 ${!isCandidate&&final?'h.d=h.baseD;':''}
 let physical=${final?'stationCandidatePhysicalDistance(h,sample.xyz+vec3<f32>(24.,0.,4.),resolveStationState(sample.xyz+vec3<f32>(24.,0.,4.)))':'h.d'};
 out.scalarFields=vec4<f32>(h.d,f32(h.id),h.seed,h.baseD);out.coordinatesAndWinner=vec4<f32>(h.q,h.sourceSeed);out.extentAndPhysical=vec4<f32>(h.extent,physical);out.inputPointAndTag=sample;return out;
}
`;
  const roots=[isCandidate?'heritageTimberCandidate':'heritageTimberReferenceSlice','stationCandidatePhysicalDistance'];
  const source=header+closure(roots,entry)+entry;
  assert(!source.includes('fn stationDomain('));assert(!source.includes('fn completeTowerTimber('));
  programs.push({name,source,sha256:sha(source),kind:isCandidate?'complete-loop':'exact-original-order-slice',range:isCandidate?[0,144]:[index*9,(index+1)*9]});
 }
 return {programs,manifest:{scope:'Finite sample-domain equivalence against exact concatenated 16-stage reference; not an all-domain proof or renderer acceptance',ages:[0,.5,1],entry:'heritageTimberProbe',width,inputHeight,outputHeight:inputHeight,attachments:4,toleranceM:1e-7,...domain,programs:programs.map(({source,...p})=>p),hashes:{receiver:sha(WGSL),referenceFunction:sha(reference),candidateFunction:sha(candidate),referenceChunks:chunks.map(sha),reconstructedReference:sha(prefix+chunks.join('')+tail)}}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const moduleURL=process.env.HERITAGE_CLOSURE_MODULE?pathToFileURL(path.resolve(process.env.HERITAGE_CLOSURE_MODULE)):new URL('../../kowloon-train88-r01/shader-closure.mjs',import.meta.url);
 const {extraction}=await import(moduleURL.href),{programs,manifest}=buildProbe(extraction),out=fileURLToPath(new URL('./heritage-timber-generated/',import.meta.url));
 fs.mkdirSync(out,{recursive:true});for(const p of programs)fs.writeFileSync(path.join(out,p.name+'.wgsl'),p.source);fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest)+'\n');
 console.log(JSON.stringify({out,programs:programs.length,points:manifest.samples.length,comparisons:manifest.samples.length*manifest.ages.length,counts:manifest.counts,hashes:manifest.hashes}));
}
