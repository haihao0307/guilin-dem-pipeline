import fs from 'node:fs';import zlib from 'node:zlib';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {loadRest11Reference} from './Rest11Reference.mjs';
import {earGeometry} from './Ear13Geometry.mjs';
import {earRestProfile,earGroups,earWeight,descendingStation,shapeEarRest,assertEarRestField,assertEarPreserved} from '../src/EarRestGroom.mjs';
import {unpackExperiment} from '../src/ExperimentTransport.mjs';
import {buildVolumeClumps,nativeNeighbours,connectedMembers} from '../src/VolumeClumps.mjs';
import {assertStructure} from '../src/StructureContract.mjs';
const base=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,base)),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),bytes=read('assets/structure.json.gz'),prefix='assets/experiments/current-rest/',lab=unpackExperiment(JSON.parse(zlib.gunzipSync(bytes)),JSON.parse(zlib.gunzipSync(read(prefix+'patch.json.gz'))),sha(bytes)),roots=new Float32Array(Uint8Array.from(zlib.gunzipSync(read(prefix+'roots.bin.gz'))).buffer),source=loadRest11Reference(),f=lab.profile.EarRestField,{geometry,accept}=earGeometry(),round=v=>JSON.parse(JSON.stringify(v,(k,v)=>typeof v==='number'&&/^\d+$/.test(k)?Math.round(v*1e9)/1e9:v));
const allowed=new Set(earGroups(source.lab.guides,source.lab.clumpGraph).flatMap(g=>g.guides));
assert.deepEqual([...allowed].sort(),source.lock.mutableGuideIDs,'Ear scope expanded beyond recorded native guide identities');assert.deepEqual(earGroups(source.lab.guides,source.lab.clumpGraph).map(g=>g.id).sort(),source.lock.sourceWispIDs);
function audit(candidate,r=roots){
 assertStructure(candidate,r);assertStructure({...candidate,guides:candidate.unshapedGuides},r);assertEarPreserved(source.lab.guides,candidate.guides,f,source.lab.clumpGraph);assertEarPreserved(source.lab.unshapedGuides,candidate.unshapedGuides,f,source.lab.clumpGraph);
 assert.deepEqual(r,source.roots,'R13 changed root bytes');for(const key of ['scalp','sourceDomain','activeMask','temporalReview','upperStudy','crownStudy','fringeStudy'])assert.deepEqual(candidate[key],source.lab[key],key);
 let bodyCrossings=0,maxTurnDegrees=0,protectedPoints=0,changedGuides=0,maxDisplacementMM=0;
 for(const key of ['guides','unshapedGuides'])for(let i=0;i<candidate[key].length;i++){
  const g=candidate[key][i],a=source.lab[key][i],metric=geometry(g);bodyCrossings+=metric.bodyCrossings;maxTurnDegrees=Math.max(maxTurnDegrees,metric.maxTurnDegrees);let changed=false;
  for(let n=0;n<97;n++){const d=Math.hypot(...g.points.slice(n*3,n*3+3).map((v,k)=>v-a.points[n*3+k]))*1000;if(d>1e-6)changed=true;maxDisplacementMM=Math.max(maxDisplacementMM,d);if(key==='guides'&&(!allowed.has(a.id)||!earWeight(a,n,f)))protectedPoints++;}
  if(key==='guides'&&changed)changedGuides++;
  assert.ok(accept(g,a),'Published guide failed whole-curve contact/curvature check');
 }
 assert.equal(bodyCrossings,0);assert.ok(maxTurnDegrees<20);const adj=nativeNeighbours(candidate.guides,r);for(const g of candidate.clumpGraph.filter(g=>g.level!=='macro'))assert.ok(connectedMembers(g.guides,adj));
 return{bodyCrossings,maxTurnDegrees,protectedPoints,changedGuides,maxDisplacementMM};
}
function delta(a,b){let max=0;for(let i=0;i<a.length;i++)for(let n=0;n<a[i].points.length;n++)max=Math.max(max,Math.abs(a[i].points[n]-b[i].points[n])*1000);return max;}
function sections(before,after){
 const a=new Map(before.map(g=>[g.id,g])),b=new Map(after.map(g=>[g.id,g])),rows=[];
 for(const group of earGroups(before,source.lab.clumpGraph))for(const y of [.32,.30,.28,.26,.24,.22,.20,.18]){
  const ids=group.guides.filter(id=>descendingStation(a.get(id),y)?.weight>.5);if(ids.length<2)continue;
  const spread=map=>{const p=ids.map(id=>descendingStation(map.get(id),y).p),c=[0,2].map(k=>p.reduce((s,q)=>s+q[k],0)/p.length);return Math.sqrt(p.reduce((s,q)=>s+(q[0]-c[0])**2+(q[2]-c[1])**2,0)/p.length)*1000;};
  rows.push({id:group.id,y,members:ids.length,beforeMM:spread(a),afterMM:spread(b)});
 }return rows;
}
assert.deepEqual(lab.guides.find(g=>g.id==='guide/2714'),source.lab.guides.find(g=>g.id==='guide/2714'),'Valid projected crossing must not be flattened');assert.deepEqual(f,earRestProfile());const actual=audit(lab),out=shapeEarRest(source.lab.guides,source.lab.clumpGraph,f,accept),raw=shapeEarRest(source.lab.unshapedGuides,source.lab.clumpGraph,f,accept);buildVolumeClumps(out.guides,roots,lab.profile);for(const g of raw.guides){const q=out.guides.find(h=>h.id===g.id);g.mid=q.mid;g.micro=q.micro;}
assert.deepEqual(round(out.guides),lab.guides,'Active groom differs from actual R13 operator');assert.deepEqual(round(raw.guides),lab.unshapedGuides);assert.deepEqual(lab.earStudy,out.report);
const stations=sections(source.lab.guides,lab.guides),sum=k=>stations.reduce((s,x)=>s+x[k]**2*x.members,0);assert.ok(sum('afterMM')<sum('beforeMM')*.9,'No measured same-height coherence improvement');
const samples=[];let previous=null;for(const strength of [0,.2,.4,.6,.8,1]){const control={...f,strength},test=shapeEarRest(source.lab.guides,source.lab.clumpGraph,control,accept);assertEarPreserved(source.lab.guides,test.guides,control,source.lab.clumpGraph);if(!strength)assert.deepEqual(test.guides,source.lab.guides);const maxStepMM=previous?delta(test.guides,previous):0;assert.ok(maxStepMM<1.21);samples.push({strength,changedGuides:test.report.changedGuides,maxDisplacementMM:test.report.maxDisplacementMM,maxStepMM});previous=test.guides;}
const negative=[];for(const kind of ['root','fringe','crown','tip','height','cut','route','singleton','root-buffer','scalp','missing-guide','excessive-cohesion','escaped-band','nonfinite-strength']){
 if(['excessive-cohesion','escaped-band','nonfinite-strength'].includes(kind))assert.throws(()=>assertEarRestField({...f,[kind==='excessive-cohesion'?'cohesion':kind==='escaped-band'?'maxSourceY':'strength']:kind==='excessive-cohesion'?1:kind==='escaped-band'?.4:NaN}));
 else{const bad=structuredClone(lab),r=roots.slice();if(kind==='root-buffer')r[10]+=.01;else if(kind==='scalp')bad.scalp.positions[0]+=.001;else if(kind==='missing-guide')bad.guides.pop();else{
  const g=bad.guides.find(g=>kind==='fringe'?g.zone<=1:kind==='singleton'?!allowed.has(g.id)&&g.zone>1:allowed.has(g.id));if(kind==='cut')g.cut.hem+=.001;else if(kind==='route')g.route='fake';else{let n=kind==='root'?0:kind==='tip'?96:kind==='crown'?1:40;g.points[n*3+(kind==='height'?1:0)]+=.001;}
 }assert.throws(()=>audit(bad,r),kind);}negative.push({kind,rejected:true});
}
const report={pass:true,checkedUTC:new Date().toISOString(),sourceCommit:source.lock.sourceCommit,sources:Object.fromEntries(['src/EarRestGroom.mjs','src/FlowExperiments.mjs','src/StructureContract.mjs','tools/Rest11Reference.mjs','tools/Ear13Geometry.mjs','tools/compile-ear13.mjs','tools/check-ear13.mjs','locks/ear-rest-r13.json'].map(p=>[p,sha(read(p))])),patchSHA256:sha(read(prefix+'patch.json.gz')),rootGzipSHA256:sha(read(prefix+'roots.bin.gz')),sourcePatchSHA256:source.lock.referenceFiles[prefix+'patch.json.gz'].sha256,actual,connectedGroups:out.report.groups.length,completeFringePreserved:24,posteriorGuides:lab.guides.filter(g=>[3,8,9].includes(g.zone)).length,stations,sectionSquaredSpreadRatio:sum('afterMM')/sum('beforeMM'),samples,negative,firstRoundAccepted:false,limits:'Bounded same-height connected-wisp coherence, exact native roots/crown/fringe/cut/tip and centreline body safety. Not dense optical coverage, inter-strand finite-radius contact, photographic reconstruction or whole-groom visual acceptance.'};fs.writeFileSync(new URL('evidence/ear13-checks.json',base),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,actual,groups:report.connectedGroups,sectionSquaredSpreadRatio:report.sectionSquaredSpreadRatio,samples:samples.length,negative:negative.length}));
