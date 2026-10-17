import {buildNativeSurface,projectDomain,normalArray,verifyNativeInput} from '../hair-f13-static-r17/generator/f12/src/NativeSurface.mjs';
import {GuideBuilder,DEFAULT,validate} from '../hair-f13-static-r17/generator/f12/src/GuideKernel.mjs';
import {splitRootPatches,buildBundleVolumes,populationBudget} from '../hair-f13-static-r17/generator/f12/src/BundleVolumes.mjs';
import {buildDenseStrands} from '../hair-f13-static-r17/generator/f12/src/DenseStrands.mjs';
import {denseHairBlob,readDenseHair} from '../hair-f13-static-r17/generator/f12/src/StrandExchange.mjs';
import {DEFAULT_STYLING,PRODUCTS} from '../hair-f13-static-r17/generator/f12/src/Styling.mjs';

const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const assert={equal(a,b){if(a!==b)throw Error('Generation invariant mismatch: '+a+' != '+b)}};
async function generate(captured){const start=performance.now(),report={schema:'r64-f12-native-generation/1',sourceCommit:'b096f916b814c230d367e1bf481d0b80489ba62f',rendererExecuted:false,shaderCompiled:false,visualAccepted:false};const log=(stage,value={})=>{report.stage=stage;Object.assign(report,value);postMessage({type:'progress',stage,...value});};

 const {input,nativeSHA}=captured,a=captured.archive,positions=input.positions;
 assert.equal(nativeSHA,'8e1a19c8e55d938c546e111783126c73378cb37739152c378e0497debcd4bfc8');
 await verifyNativeInput(input);log('native-input-verified',{nativeSHA,adapter:input.adapter,topology:input.topology});
 const surface=buildNativeSurface(input),scalp=projectDomain(surface,input.chart),normals=normalArray(surface.head.positions,surface.head.triangles),builder=new GuideBuilder(surface.head,surface.roots,normals),recipe=validate(DEFAULT);
 log('native-surface-built',{nativeReport:surface.report,scalpAreaCM2:scalp.area*1e4,recipe});
 const state=builder.build(recipe);log('guides-built',{guideCount:state.curves.length});const patches=splitRootPatches(scalp,recipe);log('patches-built',{patchCount:patches.patches.length});state.volumes=buildBundleVolumes(patches,state,builder);state.population=populationBudget(patches,recipe.hairDensity);
 log('bundle-volumes-built',{guideCount:state.curves.length,clumps:builder.denseModels.length,population:state.population});
 state.strands=buildDenseStrands(builder,state.population,(generated,total)=>postMessage({type:'progress',stage:'dense',generated,total}));
 log('dense-generated',{strandStats:Object.fromEntries(Object.entries(state.strands).filter(([k])=>k!=='parts'))});
 let rootErrorMM=0,invalidBarycentrics=0,nonFinite=0;const mins=[Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity];
 for(const part of state.strands.parts){for(let i=0;i<part.positions.length;i+=3){const p=surface.toNative(Array.from(part.positions.subarray(i,i+3)));part.positions.set(p,i);for(let k=0;k<3;k++){if(!Number.isFinite(p[k]))nonFinite++;mins[k]=Math.min(mins[k],p[k]);maxs[k]=Math.max(maxs[k],p[k]);}}
  for(let i=0;i<part.count;i++){const face=part.bindings[i*4],w=Array.from(part.bindings.subarray(i*4+1,i*4+4));if(!Number.isInteger(face)||face<0||face>=50624||w.some(x=>x< -1e-8||x>1+1e-8)||Math.abs(w.reduce((s,x)=>s+x,0)-1)>1e-8)invalidBarycentrics++;const p=[0,1,2].map(k=>w.reduce((v,b,j)=>v+b*positions[input.triangles[face*3+j]*3+k],0)),q=Array.from(part.positions.subarray(i*49*3,i*49*3+3));rootErrorMM=Math.max(rootErrorMM,Math.hypot(...p.map((v,k)=>v-q[k]))*1000);}
 }
 const metadata={nativeSource:surface.report.source,target:'R64 current native identity',nativePositionSHA256:await sha(new Float64Array(positions).buffer),personArchive:a,recipe,motionProfile:{schema:'kaopu/dense-motion-profile@1',coefficientVersion:'F12-local-styling@1',sourceCommit:report.sourceCommit,productProfiles:PRODUCTS,styling:DEFAULT_STYLING,freedom:.8,solverImplemented:false},physicsImplemented:false};
 const {header,blob}=denseHairBlob(state.strands.parts,metadata),buffer=await blob.arrayBuffer();readDenseHair(buffer);
 assert.equal(captured.nativeIdentityUnchanged,true);assert.equal(invalidBarycentrics,0);assert.equal(nonFinite,0);
 log('complete',{count:header.count,samplesPerStrand:49,parts:header.parts.length,byteLength:buffer.byteLength,denseSHA256:await sha(buffer),rootErrorMM,invalidBarycentrics,nonFinite,bounds:{min:mins,max:maxs},nativeIdentityUnchanged:true,elapsedSeconds:(performance.now()-start)/1000});

 return {buffer,report};
}
onmessage=async e=>{try{const r=await generate(e.data);postMessage({type:'complete',...r},[r.buffer]);}catch(error){postMessage({type:'error',error:String(error.stack||error)});}};
