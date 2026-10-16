/** Local numerical generation only. Uses the fixed complete F12/F13 system with an isolated U07 long-flow recipe and root-patch authoring. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {buildNativeSurface,projectDomain,normalArray,verifyNativeInput} from './f12/src/NativeSurface.mjs';
import {GuideBuilder,DEFAULT,validate} from './f12/src/GuideKernel.mjs';
import {splitRootPatches,buildBundleVolumes,populationBudget} from './f12/src/BundleVolumes.mjs';
import {buildDenseStrands} from './f12/src/DenseStrands.mjs';
import {denseHairBlob,readDenseHair} from './f12/src/StrandExchange.mjs';
import {DEPTH_RELATIONS} from './f12/src/DepthRelations.mjs';
import {U07_LONG_STUDY,U07_LENGTH_PROFILE} from './f12/src/U07LongFlow.mjs';
import {DEFAULT_STYLING,PRODUCTS} from './f12/src/Styling.mjs';
const root=process.argv[3]?new URL('file://'+process.argv[3].replace(/\/$/,'')+'/'):new URL('.',import.meta.url),inputPath=process.argv[2]||new URL('R64-GENERATOR-INPUT.json',root),sha=a=>crypto.createHash('sha256').update(a).digest('hex'),start=performance.now();
fs.mkdirSync(root,{recursive:true});
const report={schema:'r64-u07-long-f13-generation-r20/1',referenceStudy:U07_LONG_STUDY,sourceCommit:'b096f916b814c230d367e1bf481d0b80489ba62f',rendererExecuted:false,shaderCompiled:false,visualAccepted:false};
const log=(stage,value={})=>{report.stage=stage;Object.assign(report,value);fs.writeFileSync(new URL('GENERATION.json',root),JSON.stringify(report,null,2));console.log(stage,JSON.stringify(value));};
try {
 const captured=JSON.parse(fs.readFileSync(inputPath)),{input,nativeSHA}=captured,a=captured.archive,positions=input.positions;
 assert.equal(nativeSHA,'8e1a19c8e55d938c546e111783126c73378cb37739152c378e0497debcd4bfc8');
 await verifyNativeInput(input);log('native-input-verified',{nativeSHA,adapter:input.adapter,topology:input.topology});
 const surface=buildNativeSurface(input),scalp=projectDomain(surface,input.chart),normals=normalArray(surface.head.positions,surface.head.triangles),builder=new GuideBuilder(surface.head,surface.roots,normals),recipe=validate(DEFAULT);
 log('native-surface-built',{nativeReport:surface.report,scalpAreaCM2:scalp.area*1e4,recipe});
 builder.u07Long=true;const state=builder.build(recipe);log('guides-built',{guideCount:state.curves.length});const patches=splitRootPatches(scalp,recipe);log('patches-built',{patchCount:patches.patches.length});state.volumes=buildBundleVolumes(patches,state,builder);state.population=populationBudget(patches,recipe.hairDensity);
 log('bundle-volumes-built',{guideCount:state.curves.length,clumps:builder.denseModels.length,population:state.population});
 state.strands=buildDenseStrands(builder,state.population,(generated,total)=>console.log('dense',generated,total));
 log('dense-generated',{strandStats:Object.fromEntries(Object.entries(state.strands).filter(([k])=>k!=='parts'))});
 const lengths=[];let rootErrorMM=0,invalidBarycentrics=0,nonFinite=0;const rootDigest=crypto.createHash('sha256');const mins=[Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity];
 for(const part of state.strands.parts){rootDigest.update(Buffer.from(part.bindings.buffer,part.bindings.byteOffset,part.bindings.byteLength));for(let j=0;j<part.count;j++){let length=0;for(let k=1;k<49;k++){const o=(j*49+k)*3;length+=Math.hypot(...[0,1,2].map(d=>part.positions[o+d]-part.positions[o-3+d]));}lengths.push(length*1000);}for(let i=0;i<part.positions.length;i+=3){const p=surface.toNative(Array.from(part.positions.subarray(i,i+3)));part.positions.set(p,i);for(let k=0;k<3;k++){if(!Number.isFinite(p[k]))nonFinite++;mins[k]=Math.min(mins[k],p[k]);maxs[k]=Math.max(maxs[k],p[k]);}}
  for(let i=0;i<part.count;i++){const face=part.bindings[i*4],w=Array.from(part.bindings.subarray(i*4+1,i*4+4));if(!Number.isInteger(face)||face<0||face>=50624||w.some(x=>x< -1e-8||x>1+1e-8)||Math.abs(w.reduce((s,x)=>s+x,0)-1)>1e-8)invalidBarycentrics++;const p=[0,1,2].map(k=>w.reduce((v,b,j)=>v+b*positions[input.triangles[face*3+j]*3+k],0)),q=Array.from(part.positions.subarray(i*49*3,i*49*3+3));rootErrorMM=Math.max(rootErrorMM,Math.hypot(...p.map((v,k)=>v-q[k]))*1000);}
 }
 const metadata={referenceLengthProfile:U07_LENGTH_PROFILE,referenceDepthRelations:DEPTH_RELATIONS,referenceStudy:U07_LONG_STUDY,nativeSource:surface.report.source,target:'R64 current native identity',nativePositionSHA256:sha(Buffer.from(new Float64Array(positions).buffer)),personArchive:a,recipe,motionProfile:{schema:'kaopu/dense-motion-profile@1',coefficientVersion:'F12-local-styling@1',sourceCommit:report.sourceCommit,productProfiles:PRODUCTS,styling:DEFAULT_STYLING,freedom:.8,solverImplemented:false},physicsImplemented:false};
 lengths.sort((a,b)=>a-b);const lengthStatsMM={min:lengths[0],p05:lengths[Math.floor(lengths.length*.05)],median:lengths[Math.floor(lengths.length*.5)],p95:lengths[Math.floor(lengths.length*.95)],max:lengths.at(-1),mean:lengths.reduce((a,b)=>a+b,0)/lengths.length};const {header,blob}=denseHairBlob(state.strands.parts,metadata),buffer=await blob.arrayBuffer();readDenseHair(buffer);fs.writeFileSync(new URL('R64-F12-complete-paths.bin',root),Buffer.from(buffer));
 assert.equal(captured.nativeIdentityUnchanged,true);assert.equal(invalidBarycentrics,0);assert.equal(nonFinite,0);
 log('complete',{rootBindingsSHA256:rootDigest.digest('hex'),lengthStatsMM,count:header.count,samplesPerStrand:49,parts:header.parts.length,byteLength:buffer.byteLength,denseSHA256:sha(Buffer.from(buffer)),rootErrorMM,invalidBarycentrics,nonFinite,bounds:{min:mins,max:maxs},nativeIdentityUnchanged:true,elapsedSeconds:(performance.now()-start)/1000});
}catch(error){log('blocked',{error:String(error.stack||error),elapsedSeconds:(performance.now()-start)/1000});process.exitCode=1;}
