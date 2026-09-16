#!/usr/bin/env node
/** T03: pinned production-source numerical audit, not full rendering acceptance.
 * Usage: node mrrolord_execution_probe_t03.mjs /path/to/R041/core.js [result.json]
 * Refuses a different core.js blob. Landscape fragment is transcribed from
 * mappedDetail() in the separately pinned lab; common octave means cancel
 * in the seam difference. Integer harmonic is a candidate, not a full repair.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const corePath = process.argv[2];
if (!corePath) throw new Error('Provide pinned R041 core.js path');
const bytes = fs.readFileSync(corePath);
const gitBlob = crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
if (gitBlob !== '7b0dfda3b2e38d50a77093d7cebebf910841e9e8') {
  throw new Error(`Refusing unverified source: ${gitBlob}`);
}
const box = { module: { exports: {} } };
vm.runInNewContext(bytes.toString('utf8'), box, {timeout: 15000, filename:'pinned-r041-core.js'});
const W = box.module.exports;
const nodeById = new Map(W.irrigation.nodes.map(n => [n.id, n]));
const fieldById = new Map(W.allFields.map(f => [f.id, f]));
const source = nodeById.get('SOURCE');
const weakHeadEdges = [], identityMismatch = [];
for (const edge of W.irrigation.edges) {
  if (!['terrace-inlet', 'field-inlet'].includes(edge.kind)) continue;
  const from = nodeById.get(edge.from), field = fieldById.get(edge.to);
  if (!from || !field) throw new Error('Unexpected missing input');
  if (field.inlet.canal !== edge.from) identityMismatch.push({
    edgeId: edge.id, fieldId: field.id, graphFrom: edge.from,
    inletCanal: field.inlet.canal, bedM: field.bed, sourceLevelM: from.level
  });
  if (from.level < field.bed) weakHeadEdges.push({
    edgeId: edge.id, fieldId: field.id, from: edge.from,
    declaredSupplyLevelM: from.level, fieldBedM: field.bed,
    deficitToBedM: field.bed-from.level
  });
}
const aboveSource = W.allFields.filter(f => f.bed > source.level)
  .map(f => ({fieldId:f.id, bedM:f.bed, excessM:f.bed-source.level}));

// Only the reviewed mathematical fragment; common per-octave subtraction
// is omitted because it cancels exactly in F(theta=0)-F(theta=2*pi).
function kernel(u,v,w) {
  return Math.cos(Math.cos(w)*Math.cos(u)+Math.cos(v)**2+Math.cos(v)*Math.cos(u));
}
function rawDetail(x,y,z,theta,harmonic) {
  const ell=2.6, N=6, dir=18*Math.PI/180, warp=.42;
  const ang=dir+warp*(.32*Math.sin(y*.16)+.18*Math.sin(theta*harmonic+y*.07));
  const ca=Math.cos(ang), sa=Math.sin(ang);
  const qx=(ca*x-sa*z)/ell, qz=(sa*x+ca*z)/ell, qy=y/(ell*2.1);
  let sum=0;
  for(let j=0,f=1;j<N;j++,f*=2) sum += .5*kernel(qx*f,qy*f,qz*f)/f;
  return sum;
}
const smooth=(a,b,x)=>{x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x);};
function radius(theta,t) {
  const core=7.4*(1-.23*t+.10*Math.sin(Math.PI*t));
  const lobes=.72*Math.sin(2*theta+.55)*Math.sin(Math.PI*Math.max(.02,Math.min(.98,t)))**1.15
    +.24*Math.sin(5*theta+1.4)*(1-.45*t);
  return Math.max(2.45,core+lobes+.72*Math.exp(-t*10)-2.25*smooth(.78,1,t)**1.65);
}
const samples=[];
for (let y=4; y<=24; y+=.1) {
  const x=radius(0,y/28), z=0;
  samples.push({yM:y,xM:x,
    originalJump:Math.abs(rawDetail(x,y,z,0,2.3)-rawDetail(x,y,z,2*Math.PI,2.3)),
    integerCandidateJump:Math.abs(rawDetail(x,y,z,0,2)-rawDetail(x,y,z,2*Math.PI,2))});
}
const worst=samples.reduce((a,b)=>a.originalJump>b.originalJump?a:b);
const candidateMax=Math.max(...samples.map(s=>s.integerCandidateJump));
const refinement=[1e-2,1e-3,1e-4,1e-5].map(epsilon=>{
  // Points approach the same branch cut from either side on the actual
  // periodic base radius. This is a continuity test, not a mesh render.
  const sample=(theta,h)=>{const r=radius(theta,worst.yM/28);
    return rawDetail(Math.cos(theta)*r,worst.yM,Math.sin(theta)*r*.82,theta,h);};
  return {epsilonRadians:epsilon,
    originalDifference:Math.abs(sample(epsilon,2.3)-sample(2*Math.PI-epsilon,2.3)),
    candidateDifference:Math.abs(sample(epsilon,2)-sample(2*Math.PI-epsilon,2))};
});
const result={
  id:'KAOPU-MRROLORD-T03-EXECUTION-20260916', observedAt:new Date().toISOString(),
  nodeVersion:process.version,
  probeSha256:crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
  sources:{
    farmland:{commit:'86d583f7844402ca23338892340f229764a5ed70',
      path:'farmland-object-dna/Farmland_Mother_R041_Cellular_Irrigation_2026-09-16/core.js',
      gitBlob,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
      exactBlobVerified:true},
    landscape:{commit:'4e1c893b2b07d8b32551b0144b1dbd7507113680',
      path:'workbenches/landscape-microscope-geometry-r1/index.html',
      gitBlob:'b1e1307a082272702251237cfbb7dcbf7c98b6e8',
      scope:'reviewed mappedDetail/kernel/mainRadius mathematical fragments, not full HTML replay'}
  },
  landscape:{sampleCount:samples.length,worstOriginalSample:worst,candidateMaxSeamDifference:candidateMax,
    seamRefinement:refinement,
    interpretation:'2.3 angular harmonic is not single-valued on the periodic cylinder. Integer 2 is a candidate seam-free harmonic, not proof of whole-mesh or geological quality.'},
  farmland:{originalGraphQA:W.irrigationValidation,sourceDeclaredLevelM:source.level,
    bedsAboveGlobalSource:aboveSource.length,bedAboveSourceExamples:aboveSource,
    declaredInletLevelBelowBedCount:weakHeadEdges.length,declaredInletLevelBelowBed:weakHeadEdges,
    inletSourceIdentityMismatches:identityMismatch,
    interpretation:'Graph connectivity passes despite identity inconsistencies and declared supply levels below field beds. The gravity-head reading is conditional on level representing water elevation, common datum, no pressure/pump/extra energy. This is not a discharge solver or proof of physical failure in a measured field.'},
  checks:{
    exactFarmlandSource:true,
    originalGraphPasses:W.irrigationValidation.ok===true,
    currentInletMetadataContradictionReproduced:identityMismatch.length>0,
    headDataCannotCertifyAllGravitySupply:weakHeadEdges.length>0 && aboveSource.length>0,
    originalAngularBranchCutReproduced:worst.originalJump>.01,
    candidateHarmonicClosesTestedSeam:candidateMax<1e-12,
    candidateRefinementReducesDifference:refinement.at(-1).candidateDifference<refinement[0].candidateDifference/100
  },
  productionStatus:'baseline defects reproduced; production code NOT modified',
  notTested:['full Landscape browser render','whole-mesh self-intersection','true local sill/head values',
    'flow or water conservation in R041','MrRolord node files','Yohei shader reproduction','target device performance',
    'Mother execution','new public version','user visual acceptance']
};
const text=JSON.stringify(result,null,2)+'\n';
if(process.argv[3])fs.writeFileSync(process.argv[3],text);
console.log(text);
if(Object.values(result.checks).some(v=>v!==true))process.exitCode=1;
