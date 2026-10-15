import fs from 'node:fs';import zlib from 'node:zlib';import assert from 'node:assert/strict';
import {refineSewnBoundaries,unmatchedSewnSites} from '../r09-board/seam-refinement.mjs';
import {ClothSolver as OriginalSolver} from '../r09-board/cloth-physics.mjs';
import {ClothSolver as GuardedSolver} from '../r09-board/material-physics.mjs';
const read=id=>JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../r09-board/native/'+id+'.json.gz',import.meta.url))));
const length=(panel,edge)=>{let result=0;for(let i=1;i<edge.length;i++){const p=panel.uvMm[edge[i-1]],q=panel.uvMm[edge[i]];result+=Math.sqrt((p[0]-q[0])**2+(p[1]-q[1])**2);}return result;};
const area=panel=>{let sum=0;for(const ids of panel.triangles){const p=ids.map(i=>panel.uvMm[i]);sum+=Math.abs(p[0][0]*(p[1][1]-p[2][1])+p[1][0]*(p[2][1]-p[0][1])+p[2][0]*(p[0][1]-p[1][1]))/2;}return sum;};
const report={cases:[],negative:[]};
for(const id of['T01','T03','T08','T17','P01','P02','P04']){
 const source=read(id),snapshot=JSON.stringify(source),packet=await refineSewnBoundaries(source),proof=packet.record.meshRefinement;
 assert.equal(JSON.stringify(source),snapshot,'source mutated');assert.deepEqual(unmatchedSewnSites(packet),[]);
 assert.equal(packet.record.positionsMm.length,packet.spec.panels.reduce((n,p)=>n+p.uvMm.length,0));
 for(let i=0;i<packet.spec.panels.length;i++){
  const p=packet.spec.panels[i],original=source.spec.panels[i];assert.equal(JSON.stringify(p.analyticCurvesMm),JSON.stringify(original.analyticCurvesMm));
  assert.ok(Math.abs(area(p)-area(original))<1e-6);for(const [name,edge]of Object.entries(p.edges))assert.ok(Math.abs(length(p,edge)-length(original,original.edges[name]))<1e-7);
  for(const tri of p.triangles)assert.ok(tri.length===3&&new Set(tri).size===3&&tri.every(k=>Number.isInteger(k)&&k>=0&&k<p.uvMm.length));
 }
 const positions=p=>new Float32Array(p.record.positionsMm.flat().map(x=>x*.001));
 const oldSolver=new OriginalSolver(source,positions(source),{family:'denim',role:id.startsWith('P')?'bottom':'top'}),newSolver=new GuardedSolver(packet,positions(packet),{family:'denim',role:id.startsWith('P')?'bottom':'top',deferContactInitialization:true});
 const mass=s=>s.mass.reduce((a,b)=>a+b,0);assert.ok(Math.abs(mass(oldSolver)-mass(newSolver))<1e-12);assert.equal(newSolver.count,oldSolver.count);
 for(const seam of packet.spec.seams){const panels=new Map(packet.spec.panels.map(p=>[p.id,p]));for(const key of['a','b'])assert.ok(panels.get(seam[key].panelId)?.edges[seam[key].edge]);}
 report.cases.push({id,sourceSchema:source.spec.schema,unpairedBefore:unmatchedSewnSites(source).reduce((n,r)=>n+r.unmatched.length,0),unpairedAfter:0,addedVertices:proof?.inserted.length||0,addedTriangles:packet.spec.panels.reduce((n,p)=>n+p.triangles.length,0)-source.spec.panels.reduce((n,p)=>n+p.triangles.length,0),massBeforeKG:mass(oldSolver),massAfterKG:mass(newSolver),physicalParticlesBefore:oldSolver.count,physicalParticlesAfter:newSolver.count,materialAreaAndIndependentEdgeLengthsUnchanged:true,analyticCurvesUnchanged:true,sourceImmutable:true});
 if(id==='P02'){
  const incomplete=structuredClone(packet),seam=incomplete.spec.seams.find(s=>s.id==='s6');seam.stitchVertexPairs.pop();assert.ok(unmatchedSewnSites(incomplete).length>0);report.negative.push('Deleting a seam equality exposes an unmatched material site');
  const broken=structuredClone(source);broken.spec.seams.find(s=>s.id==='s6').stitchVertexPairs=broken.spec.seams.find(s=>s.id==='s6').stitchVertexPairs.slice(1);await assert.rejects(()=>refineSewnBoundaries(broken),/ANCHORS/);report.negative.push('Missing endpoint anchor is rejected');
  assert.throws(()=>new GuardedSolver(source,positions(source)),/UNCONSTRAINED/);report.negative.push('The runtime rejects the old sparsely constrained seam');
  fs.writeFileSync(new URL('./r09-refined-P02.json.gz',import.meta.url),zlib.gzipSync(JSON.stringify(packet)));
 }
}
fs.writeFileSync(new URL('./r09-seam-refinement-test.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
