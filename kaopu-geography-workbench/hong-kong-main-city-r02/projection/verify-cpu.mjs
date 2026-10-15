#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PATCH_PLAN,patchVerified,countExact,PROJECTION,sha256} from './patch-plan.mjs';
import {projectionSourceURLs} from './source-layout.mjs';
import {auditBlobDependencies} from './bundle-loader.mjs';
import {TEST_NEAR_VALUES,REQUIRED_CLIP_PARTICIPANTS,makeSharedTestProjection,chooseSharedNearTestCandidate,assertClipParticipantsSynchronized,float32DepthDiagnostic} from './shared-near-test-candidate.mjs';
import {fitRegion,regionCorners,projectRaw,mapCamera,depthAt,depthStepM,cameraReport} from './camera.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..');
const report={schema:'hk-shared-camera-projection-cpu/1',cpuPassed:false,gpuStatus:'NOT RUN: prepared comparison harness only; no Chromium/WebGL context started',sourceWrites:0,projection:PROJECTION,fullRegionHeightEnvelopeM:[-100,1500],checks:{},viewports:[],depth24:[]};
const patched={},sources=projectionSourceURLs(import.meta.url,{publishedLayout:process.argv.includes('--published-layout')});
for(const [key,p]of Object.entries(PATCH_PLAN))patched[key]=await patchVerified(key,await fs.readFile(sources[key]));
report.checks.patchFiles=Object.keys(patched).length;
report.checks.patchedShaderProjectionSites=4+1+1+1;
assert.equal(countExact(patched.three.text,'adhesiveMassKg:6e4'),2);
assert.equal(countExact(patched.three.text,'new Mt(55,1,.15,15e4)'),1);
assert.equal(countExact(patched.three.text,'6e4'),2);
report.checks.trainMassTokensPreserved=2;
report.checks.blobDependencies=auditBlobDependencies(patched.three.text);
await assert.rejects(()=>patchVerified('r03',awaitableCorruption()),/SHA mismatch/);
function awaitableCorruption(){return new TextEncoder().encode('not the pinned source');}
await assert.rejects(()=>patchVerified('three',patched.three.text),/SHA mismatch/); // Reject double application.
report.checks.hashMismatchAndDoublePatchRejected=true;
// Export actual bundled Three classes only in an in-memory test module; no third-party package
// approximation and no production file modification. Constructing a camera does not need a GPU.
const testSource=patched.three.text+'\nexport{Mt as TestPerspectiveCamera,O as TestVector3,He as TestMatrix4};\n';
let actual;try{actual=await import('data:text/javascript;base64,'+Buffer.from(testSource).toString('base64'));}catch(e){console.error('Could not load actual Three camera for CPU test: '+e.message);process.exit(1);}
const {TestPerspectiveCamera:PerspectiveCamera}=actual;
const mul=(m,v)=>[0,1,2,3].map(row=>m[row]*v[0]+m[4+row]*v[1]+m[8+row]*v[2]+m[12+row]*v[3]);
const cases=[[1920,1080],[1440,1080],[1080,1080],[844,390],[390,844],[360,800],[375,812],[320,896]];
const comparisons=[];let matrixMaxClipError=0,matrixMaxNdcError=0,pointCount=0;
let seed=0x31415926;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
for(const [width,height]of cases){
 const aspect=width/height,fit=fitRegion(aspect);
 report.viewports.push({width,height,aspect,supported:fit.supported,...fit.supported?{distanceM:fit.state.distance,yaw:fit.state.yaw,pitch:fit.state.pitch,target:fit.state.target,allEightCornersInside:fit.report.allInside,maxAbsNdcXY:fit.report.maxAbsNdcXY,depthRangeM:fit.report.depthRangeM,farSlackM:fit.report.farSlackM,corners:fit.report.corners}:{reason:fit.reason,attempts:fit.attempts.map(a=>({yaw:a.state.yaw,requiredDistanceM:a.state.distance,maxDistanceM:a.maxDistanceM,farSlackM:a.report.farSlackM}))}});
 if(width===320){assert.equal(fit.supported,false);continue;}
 assert.equal(fit.supported,true);assert.equal(fit.report.allInside,true);assert(fit.report.maxAbsNdcXY<=1/1.08+1e-12);assert(fit.report.farSlackM>=100);
 comparisons.push({camera:fit.camera,aspect,points:regionCorners()});
}
for(const state of [{target:[4000,15,7350],distance:450,yaw:-.9,pitch:-.64},{target:[1521.171,5.8,9775.015],distance:12,yaw:1.1,pitch:-.2},{target:[0,0,0],distance:45000,yaw:-.9,pitch:-.64}])comparisons.push({camera:mapCamera(state),aspect:16/9,points:[]});
for(const {camera:c,aspect,points}of comparisons){
 const actualCamera=new PerspectiveCamera(55,aspect,.15,150000);actualCamera.position.set(...c.cam);actualCamera.up.set(...c.up);actualCamera.lookAt(...c.cam.map((v,i)=>v+c.fw[i]));actualCamera.updateProjectionMatrix();actualCamera.updateMatrixWorld(true);
 for(let n=0;n<500;n++){const z=.151*Math.pow(149999/.151,random()),x=(random()*1.8-.9)*z*PROJECTION.tanFov*aspect,y=(random()*1.8-.9)*z*PROJECTION.tanFov;points.push(c.cam.map((v,i)=>v+c.fw[i]*z+c.right[i]*x+c.up[i]*y));}
 for(const p of points){const raw=projectRaw(p,c,aspect),mv=mul(actualCamera.matrixWorldInverse.elements,[...p,1]),clip=mul(actualCamera.projectionMatrix.elements,mv),clipError=Math.max(...raw.map((x,i)=>Math.abs(x-clip[i]))),ndcError=Math.max(...raw.slice(0,3).map((x,i)=>Math.abs(x/raw[3]-clip[i]/clip[3])));matrixMaxClipError=Math.max(matrixMaxClipError,clipError);matrixMaxNdcError=Math.max(matrixMaxNdcError,ndcError);assert(ndcError<2e-8);pointCount++;}
}
report.checks.actualBundledThreeCamera={points:pointCount,maxClipAbsoluteError:matrixMaxClipError,maxNdcAbsoluteError:matrixMaxNdcError,passToleranceNdc:2e-8,worldViewAndProjectionTested:true};
const manifest=JSON.parse(await fs.readFile(sources.outerManifest,'utf8'));
assert.deepEqual(manifest.boundsEPSG2326,[796320,795730,869640,856720]);assert.deepEqual(manifest.originEastingNorthing,[834000,827000]);
const hMin=Math.min(...manifest.chunks.map(c=>c.heightMinMaxM[0])),hMax=Math.max(...manifest.chunks.map(c=>c.heightMinMaxM[1]));assert(hMin>=-100&&hMax<=1500);report.checks.sourceHeightEnvelope={sourceMinM:hMin,sourceMaxM:hMax,envelopeContainsSource:true};
// Every manifest AABB (including ocean chunks and interior nodes) must fit on supported screens.
for(const v of report.viewports.filter(v=>v.supported)){
 const fit=fitRegion(v.aspect);let count=0;
 for(const chunk of manifest.chunks){const b=chunk.boundsEPSG2326Nodes;const pts=[b[0],b[2]].flatMap(E=>[chunk.heightMinMaxM[0]-5,chunk.heightMinMaxM[1]+5].flatMap(H=>[b[1],b[3]].map(N=>[E-834000,H,827000-N])));assert(cameraReport(fit.camera,v.aspect,pts).allInside);count+=pts.length;}
 v.manifestChunkCornerChecks=count;
}
for(const z of [.15,1,10,100,1000,10000,30000,60000,100000,150000])report.depth24.push({viewDepthM:z,windowDepth:depthAt(z),approxOneDepth24LSBM:depthStepM(z),old60kmApproxLSBM:depthStepM(z,24,{near:.15,far:60000}),newToOldRatio:depthStepM(z)/depthStepM(z,24,{near:.15,far:60000})});
report.checks.airportOldTanFovRelativeError=(.520567-PROJECTION.tanFov)/PROJECTION.tanFov;
report.checks.glslFloat32DepthCoefficients={old60km:{A:Math.fround((60000+.15)/(60000-.15)),B:Math.fround(-2*60000*.15/(60000-.15))},new150km:{A:Math.fround((150000+.15)/(150000-.15)),B:Math.fround(-2*150000*.15/(150000-.15))}};
// Explicitly diagnostic: GPU contraction/constant folding is implementation-dependent.
// This emulates one non-fused Float32 coefficient evaluation and D24 rounding, not a GPU run.
report.float32DepthRiskDiagnostic=report.viewports.filter(v=>v.supported).map(v=>{
 const A=Math.fround((150000+.15)/(150000-.15)),B=Math.fround(2*150000*.15/(150000-.15));
 const depths=v.corners.map(c=>{const z=Math.fround(c.viewDepthM),clipZ=Math.fround(Math.fround(A*z)-B),windowDepth=clipZ/z*.5+.5,d24=Math.round(windowDepth*(2**24-1));return {viewDepthM:c.viewDepthM,emulatedClipZ:clipZ,emulatedW:z,windowDepth,emulatedD24:d24,atOrBeyondClearDepth:d24>=2**24-1};});
 return {viewport:[v.width,v.height],warningOnlyNotGPUEvidence:true,possiblyLostCorners:depths.filter(d=>d.atOrBeyondClearDepth).length,depths};
});
report.sharedNearTestCandidates=[];
for(const near of TEST_NEAR_VALUES){
 const spec=makeSharedTestProjection(near),participants=Object.fromEntries(REQUIRED_CLIP_PARTICIPANTS.map(k=>[k,spec]));assert(assertClipParticipantsSynchronized(participants,spec));
 assert.throws(()=>assertClipParticipantsSynchronized({...participants,airport:{near:near===.15?10:.15,far:150000}},spec),/Unsynchronized/);
 assert.equal(chooseSharedNearTestCandidate({mode:'follow',distance:100000,overviewNear:near}).near,.15);assert.equal(chooseSharedNearTestCandidate({mode:'map',distance:2000,overviewNear:near}).near,.15);
 const candidate={near,far:150000,testOnly:true,productionPatchesStillNear:.15,participantsChecked:REQUIRED_CLIP_PARTICIPANTS,desynchronizationRejected:true,closeAndFollowRemainNear:.15,depth24AtM:[100,1000,10000,60000,100000,140000].map(z=>({z,oneLSBApproxM:depthStepM(z,24,spec)})),viewports:[]};
 let maxMatrixNdcError=0;
 for(const v of report.viewports.filter(x=>x.supported)){
  const fit=fitRegion(v.aspect),c=fit.camera,tc=new PerspectiveCamera(55,v.aspect,near,150000);tc.position.set(...c.cam);tc.up.set(...c.up);tc.lookAt(...c.cam.map((x,i)=>x+c.fw[i]));tc.updateMatrixWorld(true);
  const depths=[];for(const corner of v.corners){const z=corner.viewDepthM,clip=[corner.clip[0],corner.clip[1],(150000+near)/(150000-near)*z-2*150000*near/(150000-near),z],actual=mul(tc.projectionMatrix.elements,mul(tc.matrixWorldInverse.elements,[...corner.world,1]));maxMatrixNdcError=Math.max(maxMatrixNdcError,...clip.slice(0,3).map((x,i)=>Math.abs(x/clip[3]-actual[i]/actual[3])));depths.push({...float32DepthDiagnostic(z,spec),oneDepth24LSBApproxM:depthStepM(z,24,spec)});}
  candidate.viewports.push({viewport:[v.width,v.height],possiblyLostCornersInNonFusedCPUModel:depths.filter(x=>x.atOrBeyondClearDepth).length,depths});
 }
 assert(maxMatrixNdcError<2e-8);candidate.actualThreeMaxNdcError=maxMatrixNdcError;candidate.gpuStatus='NOT RUN';report.sharedNearTestCandidates.push(candidate);
}
report.cpuPassed=true;
await fs.writeFile(path.join(here,'CPU-RESULTS.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({cpuPassed:true,gpuStatus:report.gpuStatus,matrix:report.checks.actualBundledThreeCamera,viewports:report.viewports.map(({width,height,supported,distanceM,depthRangeM,farSlackM})=>({width,height,supported,distanceM,depthRangeM,farSlackM}))},null,2));
