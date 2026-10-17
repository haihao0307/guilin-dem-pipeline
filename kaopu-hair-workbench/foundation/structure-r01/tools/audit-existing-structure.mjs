// Audits the bytes the public viewer consumes. Does not regenerate hair.
import fs from 'node:fs';import zlib from 'node:zlib';import crypto from 'node:crypto';
import {unpackExperiment} from '../src/ExperimentTransport.mjs';
import {assertStructure} from '../src/StructureContract.mjs';
const base=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,base)),load=p=>JSON.parse(zlib.gunzipSync(read(p))),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const baseline=load('assets/structure.json.gz'),manifest=JSON.parse(read('assets/ASSET_MANIFEST.json')),runtime=JSON.parse(read('BUILD_MANIFEST.json')).htmlSHA256;
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),sub=(a,b)=>a.map((v,k)=>v-b[k]),unit=v=>v.map(x=>x/(Math.hypot(...v)||1)),angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,dot(unit(a),unit(b)))))*180/Math.PI;
const quantile=(a,p)=>a.slice().sort((a,b)=>a-b)[Math.floor((a.length-1)*p)];
const cases=[];
for(const id of ['baseline','part-small','part-left','fringe-open','ear-back']){
 const prefix=id==='baseline'?'assets/':'assets/experiments/'+id+'/',lab=id==='baseline'?baseline:unpackExperiment(baseline,load(prefix+'patch.json.gz'),sha(read('assets/structure.json.gz'))),bytes=read(prefix+'roots.bin.gz'),rootManifest=manifest[id==='baseline'?'roots':id+'/roots'];
 if(sha(bytes)!==rootManifest.sha256)throw Error('Root bytes do not match published manifest');
 const roots=new Float32Array(Uint8Array.from(zlib.gunzipSync(bytes)).buffer);assertStructure(lab,roots);assertStructure({...lab,guides:lab.unshapedGuides},roots);
 let maskMismatches=0,maxRootErrorMM=0,maxArcErrorMM=0,maxCutEndpointErrorMM=0,maxCutHeightErrorMM=0,maxFrameTangentErrorDegrees=0,maxTurnDegrees=0,turnsOver30=0,nonfiniteRoots=0;
 const rootAngles=[],sharpTurns=[];
 for(let i=0;i<roots.length;i++)if(!Number.isFinite(roots[i]))nonfiniteRoots++;
 for(let i=0;i<lab.rootCount;i++)if(Boolean(roots[i*lab.stride+25])!==lab.activeMask[i])maskMismatches++;
 for(const g of lab.guides){
  const at=n=>g.points.slice(n*3,n*3+3),N=g.points.length/3,root=Array.from(roots.subarray(g.rootId*lab.stride+4,g.rootId*lab.stride+7));
  maxRootErrorMM=Math.max(maxRootErrorMM,Math.hypot(...sub(at(0),root))*1000);
  maxCutEndpointErrorMM=Math.max(maxCutEndpointErrorMM,Math.hypot(...sub(at(N-1),g.cut.endpoint))*1000);maxCutHeightErrorMM=Math.max(maxCutHeightErrorMM,Math.abs(at(N-1)[1]-g.cut.hem)*1000);
  let arc=0;for(let n=0;n<N;n++){
   if(n)arc+=Math.hypot(...sub(at(n),at(n-1)));maxArcErrorMM=Math.max(maxArcErrorMM,Math.abs(g.arcLengths[n]-arc)*1000);
   maxFrameTangentErrorDegrees=Math.max(maxFrameTangentErrorDegrees,angle(sub(at(Math.min(N-1,n+1)),at(Math.max(0,n-1))),g.frames.slice(n*9,n*9+3)));
   if(n>0&&n<N-1){const a=angle(sub(at(n),at(n-1)),sub(at(n+1),at(n)));maxTurnDegrees=Math.max(maxTurnDegrees,a);if(a>30){turnsOver30++;sharpTurns.push({guide:g.id,zone:g.zone,node:n,arcMM:g.arcLengths[n]*1000,angle:a});}}
  }
  const stored=Array.from(roots.subarray(g.rootId*lab.stride+13,g.rootId*lab.stride+16));rootAngles.push({guide:g.id,zone:g.zone,degrees:angle(sub(at(1),at(0)),stored)});
 }
 const old=baseline.guides;const changes=lab.guides.map(g=>{const b=old.find(q=>q.id===g.id);return{id:g.id,zone:g.zone,rmsMM:Math.sqrt(g.points.reduce((s,x,k)=>s+(x-b.points[k])**2,0)/(g.points.length/3))*1000};});
 cases.push({id,guides:lab.guides.length,unshapedStructureValidated:true,eligible:lab.sourceDomain.eligibleMask.filter(Boolean).length,active:lab.activeMask.filter(Boolean).length,maskMismatches,nonfiniteRoots,maxRootErrorMM,maxArcErrorMM,maxCutEndpointErrorMM,maxCutHeightErrorMM,maxFrameTangentErrorDegrees,maxTurnDegrees,turnsOver30,sharpTurns:sharpTurns.sort((a,b)=>b.angle-a.angle).slice(0,8),rootDirectionVersusFirstChord:{medianDegrees:quantile(rootAngles.map(a=>a.degrees),.5),p90Degrees:quantile(rootAngles.map(a=>a.degrees),.9),over45:rootAngles.filter(a=>a.degrees>45).length,worst:rootAngles.sort((a,b)=>b.degrees-a.degrees).slice(0,6),interpretation:'Contact routing and finite sample spacing can change the first chord. Large discrepancies require visual review; not an automatic physiological failure threshold.'},largestEditChanges:changes.sort((a,b)=>b.rmsMM-a.rmsMM).slice(0,4)});
}
const roots=new Float32Array(Uint8Array.from(zlib.gunzipSync(read('assets/roots.bin.gz'))).buffer),probes=[];
const probe=(name,mutate)=>{const lab=structuredClone(baseline),r=roots.slice();mutate(lab,r);let rejected=false,message=null;try{assertStructure(lab,r);}catch(e){rejected=true;message=e.message;}probes.push({name,rejected,message});};
probe('guide root moved without changing follicle binding',x=>x.guides[0].points[0]+=.001);
probe('monotonic arcs scaled with matching declared length',x=>{const g=x.guides[0];g.arcLengths=g.arcLengths.map(v=>v*1.01);g.length=g.arcLengths.at(-1);});
probe('orthonormal frame tangent reversed',x=>{const g=x.guides[0];for(let k=0;k<3;k++){g.frames[k]*=-1;g.frames[6+k]*=-1;}});
probe('left handed orthonormal frame',x=>{for(let k=6;k<9;k++)x.guides[0].frames[k]*=-1;});
probe('stored cut endpoint detached from actual tip',x=>x.guides[0].cut.endpoint[0]+=.01);
probe('active mask disagrees with actual root buffer',x=>{const g=x.guides[0];x.activeMask[g.rootId]=false;});
const unusedControls=[{field:'RootLiftField.hairline',value:baseline.profile.RootLiftField.hairline,actual:new Set(Array.from({length:baseline.rootCount},(_,i)=>roots[i*baseline.stride+18])).size,issue:'Compiler reads interior only; all stored lift values are identical.'},{field:'PartingCurves[0].width',value:baseline.profile.PartingCurves[0].width,issue:'Direction and density use separate numeric widths, not this control.'},{field:'HairlineProfile.irregularity',value:baseline.profile.HairlineProfile.irregularity,issue:'Declared but no consumer generates boundary detail from it.'}];
const before=process.argv[2]?JSON.parse(read(process.argv[2])):null;
const report={checkedUTC:new Date().toISOString(),runtimeSHA256:runtime,structureSHA256:sha(read('assets/structure.json.gz')),hairGeometryChanged:false,cases,contractProbes:probes,contractBeforeHardening:before?{sourceCommit:'e1e0d9fb6bde247a9a1d04ddd4dcfe3e0b42578a',runtimeSHA256:before.runtimeSHA256,probes:before.contractProbes}:null,unusedControls,limitations:['No dynamic, finite-radius or self-collision certificate.','Root angles and sharp turns are diagnostics, not universal hair-shape scores.','Dense coverage, optics, tapered diameters and other two length grooms are absent, so cannot pass their visual acceptance.']};
fs.writeFileSync(new URL('evidence/previous-work-audit05.json',base),JSON.stringify(report,null,2));console.log(JSON.stringify({cases:cases.map(({sharpTurns,rootDirectionVersusFirstChord,...c})=>({...c,rootAngleMedian:rootDirectionVersusFirstChord.medianDegrees,rootAngleP90:rootDirectionVersusFirstChord.p90Degrees,rootAnglesOver45:rootDirectionVersusFirstChord.over45})),contractProbes:probes,unusedControls},null,2));
