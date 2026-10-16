import {assertStructure} from '../src/StructureContract.mjs';
import {connectHairRuntime,assertPhaseTwoAccepted} from './R08Runtime.mjs';

// Recipient-owned layout. Donor caches/solvers must consume this input rather
// than import their fixed Groom constants (96 guides / 25 nodes / old roots).
export function createStructureRuntimeInput(structure, roots, structureSHA256) {
 assertStructure(structure, roots);
 if(!/^[a-f0-9]{64}$/.test(structureSHA256||''))throw Error('Missing structure digest');
 const guides=structure.guides, count=guides.length;
 const offsets=new Uint32Array(count+1),rootIds=new Uint32Array(count),triangles=new Uint32Array(count),zones=new Uint8Array(count);
 let total=0;for(let i=0;i<count;i++){offsets[i]=total;total+=guides[i].points.length/3;}offsets[count]=total;
 const rest=new Float64Array(total*3),frames=new Float64Array(total*9),arcs=new Float64Array(total),barycentric=new Float64Array(count*3),diameters=new Float32Array(count);
 const groupIndex=new Map(structure.clumpGraph.map((g,i)=>[g.id,i])),groups=new Uint32Array(count*3);
 for(let i=0;i<count;i++){
  const g=guides[i],n=offsets[i];rootIds[i]=g.rootId;triangles[i]=g.root.triangleId;zones[i]=g.zone;
  rest.set(g.points,n*3);frames.set(g.frames,n*9);arcs.set(g.arcLengths,n);barycentric.set(g.root.barycentric,i*3);
  diameters[i]=roots[g.rootId*structure.stride+structure.rootColumns.indexOf('strandDiameter')];
  for(const [j,level]of ['macro','mid','micro'].entries())groups[i*3+j]=groupIndex.get(g[level]);
 }
 // No root resampling, first-node displacement, mass/stiffness invention or
 // settling pass. A backend gets copied buffers and exact authored rest shape.
 const input={schema:'kaopu/structure-runtime-input@1',profileId:structure.profile.id,structureSHA256,
  guideIds:guides.map(g=>g.id),guideCount:count,nodeCount:total,offsets,rootIds,triangles,barycentric,zones,rest,frames,arcs,diameters,groups,
  graph:structuredClone(structure.clumpGraph),nativeTransform:structuredClone(structure.nativeTransform),
  report(){return{profileId:this.profileId,guideCount:count,nodeCount:total,coordinates:'head-aligned metres',frameColumns:['tangent','normal','binormal'],rootIdentity:'native triangle + barycentric + stable candidate id',fixedDonorGroom:false,physicsEnabled:false,denseRendererLoaded:false};}};
 return input;
}

// Local displacement uses each guide's transported frame. In particular this
// never averages unrelated guide world positions through the skull.
export function localOffsetPoint(input,guideIndex,nodeIndex,normalOffset=0,binormalOffset=0){
 if(!Number.isInteger(guideIndex)||guideIndex<0||guideIndex>=input.guideCount)throw Error('Invalid guide index');
 const start=input.offsets[guideIndex],end=input.offsets[guideIndex+1];
 if(!Number.isInteger(nodeIndex)||nodeIndex<0||start+nodeIndex>=end||![normalOffset,binormalOffset].every(Number.isFinite))throw Error('Invalid guide sample');
 const n=start+nodeIndex,p=n*3,f=n*9;
 return [0,1,2].map(k=>input.rest[p+k]+input.frames[f+3+k]*normalOffset+input.frames[f+6+k]*binormalOffset);
}

export function connectStructureRuntime({input,profile,receipt,backend}){
 // Acceptance precedes creating a solver or touching renderer/animation hooks.
 if(!input||input.profileId!==profile?.id)throw Error('Runtime input/profile mismatch');
 assertPhaseTwoAccepted(profile,receipt,input.structureSHA256);
 if(typeof backend?.createPorts!=='function')throw Error('A variable-guide structure backend is required');
 const ports=backend.createPorts(input);
 try{return connectHairRuntime({profile,receipt,structureSHA256:input.structureSHA256,ports});}
 catch(error){ports?.release?.();throw error;}
}
