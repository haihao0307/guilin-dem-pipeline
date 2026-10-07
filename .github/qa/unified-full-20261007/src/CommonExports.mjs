import * as THREE from '../source/registration-vendor/three.module.js';
import {exportOBJ,exportGLB,exportUSD} from './NativeSnapshotExporters.mjs';
import {nativeRotationToCommon} from './HeadMath.mjs';

const matrix=values=>new THREE.Matrix4().set(...values);
const rowMajor=m=>{const e=m.elements;return [e[0],e[4],e[8],e[12],e[1],e[5],e[9],e[13],e[2],e[6],e[10],e[14],e[3],e[7],e[11],e[15]];};
const toY=new THREE.Matrix4().set(1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1);
const gnmNames=['neck','head','left_eye','right_eye'];
/** Evaluated pose snapshot. The original nonlinear controls remain in archive.
 * Exported conventional skinning does not replace MHR MLP or the conditioned
 * per-influence body rest packet for subsequent native-parameter animation.
 */
export function commonSnapshot(model){
 if(!model.hasValidState||!model.lastBodyDriver)throw Error('Evaluate the complete common model before exporting');
 const result=model.lastBodyDriver,g=model.gnm,c=model.canonical,rig=result.rig;
 const positions=new Float32Array(model.positions.length);
 for(let i=0;i<positions.length;i+=3){positions[i]=model.positions[i];positions[i+1]=model.positions[i+2];positions[i+2]=-model.positions[i+1];}
 const world=rig.posedMatrices.map(matrix),parents=rig.parents.slice(),names=rig.names.slice(),bodyJointCount=names.length;
 let headPoints;
 if(model.headTransfer&&!model.headTransfer.last.nativeGNMPath)headPoints=model.lastHeadRig.jointsPosed;
 else{
  const state=model.effectiveState,rest=model.anny.forward({phenotypes:state.anny.phenotypes,localChanges:state.anny.localChanges}),head=rest.boneHeads.slice(model.headBone*3,model.headBone*3+3),t=c.headTransform.translation,s=model.headScale;
  headPoints=Array.from({length:4},(_,j)=>{const p=g.jointsWorld.subarray(j*3,j*3+3),q=[p[0]+t[0],-p[2]+t[1],p[1]+t[2]];return q.map((x,k)=>head[k]+s*(x-model.referenceHead[k]));});
 }
 const gaze=[null,null];
 if(model.state.owners.gaze==='rig'&&model.state.owners.rig==='anny'){
  const s=model.effectiveState,shape={phenotypes:s.anny.phenotypes,localChanges:s.anny.localChanges},zero=model.anny.forward(shape),pose={};
  for(const key of['eye.L','eye.R'])pose[key]={rotation:s.anny.pose[key]||[0,0,0],translation:s.anny.translations[key]||[0,0,0]};
  const active=model.anny.forward({...shape,pose}),A=matrix(model.headTransfer.d.anny_source_to_gnm).setPosition(0,0,0),Ai=A.clone().invert();
  for(let eye=0;eye<2;eye++){const j=model.anny.boneLabels.indexOf(eye?'eye.R':'eye.L'),delta=matrix(active.bonePoses.slice(j*16,j*16+16)).multiply(matrix(zero.bonePoses.slice(j*16,j*16+16)).invert()).setPosition(0,0,0);gaze[eye]=A.clone().multiply(delta).multiply(Ai);}
 }
 const headWorld=Array.from({length:4},(_,j)=>{const r=nativeRotationToCommon(g._rotWorld,j*9),m=matrix([r[0],r[1],r[2],0,r[3],r[4],r[5],0,r[6],r[7],r[8],0,0,0,0,1]);if(j>=2&&gaze[j-2])m.multiply(gaze[j-2]);return m.setPosition(...headPoints[j]);});
 const derived=new Map();
 for(const sourceIndex of new Set(c.headSkinIndices.flat())){
  const alias=model.anny.boneLabels[sourceIndex],attachment=result.attachment[alias];if(!attachment)throw Error('Unsupported head attachment '+alias);
  const start=world.length;derived.set(sourceIndex,start);
  for(let j=0;j<4;j++){world.push(matrix(attachment.bodySkin).multiply(headWorld[j]));names.push('common_'+alias+'_GNM_'+gnmNames[j]);parents.push(g.jointParents[j]<0?attachment.index:start+g.jointParents[j]);}
 }
 const ptr=[0],jointIndices=[],weights=[];let omittedMax=0,omittedSum=0,prunedVertices=0;
 for(let v=0;v<model.vertexCount;v++){
  const row=new Map();
  if(v<model.bodyCount){for(let k=rig.weights.ptr[v];k<rig.weights.ptr[v+1];k++)row.set(rig.weights.joints[k],rig.weights.values[k]);}
  else{const h=v-model.bodyCount,[a,b,t]=c.gnmRecipes[h];for(let k=0;k<c.headSkinIndices[h].length;k++){const start=derived.get(c.headSkinIndices[h][k]),outer=c.headSkinWeights[h][k];for(let j=0;j<4;j++){const w=outer*((1-t)*g.skinningWeights[j*g.numVertices+a]+t*g.skinningWeights[j*g.numVertices+b]);if(w>0)row.set(start+j,(row.get(start+j)||0)+w);}}}
  const list=[...row].sort((a,b)=>b[1]-a[1]);const sum=list.reduce((n,x)=>n+x[1],0);if(!(sum>0))throw Error('Unbound canonical vertex '+v);
  for(const[j,w]of list){jointIndices.push(j);weights.push(w);}ptr.push(weights.length);
  const omitted=list.slice(4).reduce((n,x)=>n+x[1],0)/sum;omittedMax=Math.max(omittedMax,omitted);omittedSum+=omitted;if(omitted>0)prunedVertices++;
 }
 // Native body labels already have topological order; derived GNM chains are
 // appended in their native parent order. Keep the assertion for USD paths.
 if(parents.some((p,j)=>p>=j))throw Error('Snapshot joint order must be topological');
 const indices4=new Uint16Array(model.vertexCount*4),weights4=new Float32Array(model.vertexCount*4);
 for(let v=0;v<model.vertexCount;v++){const n=Math.min(4,ptr[v+1]-ptr[v]);let sum=0;for(let k=0;k<n;k++)sum+=weights[ptr[v]+k];for(let k=0;k<n;k++){indices4[v*4+k]=jointIndices[ptr[v]+k];weights4[v*4+k]=weights[ptr[v]+k]/sum;}}
 const joints=new Float64Array(world.length*8);const worldY=world.map(w=>toY.clone().multiply(w));
 let nonUniformScaleMax=0;
 for(let j=0;j<worldY.length;j++){const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();worldY[j].decompose(p,q,s);nonUniformScaleMax=Math.max(nonUniformScaleMax,Math.max(s.x,s.y,s.z)-Math.min(s.x,s.y,s.z));joints.set([p.x*100,p.y*100,p.z*100,q.x,q.y,q.z,q.w,(s.x+s.y+s.z)/3],j*8);}
 return{schema:'common-person-evaluated-snapshot/1',positions,faces:model.faces.slice(),joints,parents,names,rig4:{indices:indices4,weights:weights4},archive:model.archive(),fullWeights:{ptr,joints:jointIndices,values:weights},worldMatricesMetresYUp:worldY.map(rowMajor),bodyJointCount,derivedHeadJointCount:world.length-bodyJointCount,nonUniformScaleMax,weightReduction:{convention:'Same strongest-four normalized snapshot convention as the native MHR web exporter; full weights remain in the snapshot JSON',prunedVertices,maxOmittedFraction:omittedMax,meanOmittedFraction:omittedSum/model.vertexCount},notes:'Current evaluated geometry with pose-matched inverse binds. For exact later native parameter changes, restore the archive in this workbench and re-evaluate the original drivers, head adapters, per-influence rest data and nonlinear correctives. This is not a baked animation or lossless standalone replacement for those solvers.'};
}
export function exportCommon(model,format){
 const s=commonSnapshot(model);let data,mime,extension;
 if(format==='obj'){data=exportOBJ(s.positions,s.faces);mime='text/plain';extension='obj';}
 else if(format==='glb'){data=exportGLB(s.positions,s.faces,s.worldMatricesMetresYUp.map(matrix),s.parents,s.names,s.rig4,0);mime='model/gltf-binary';extension='glb';}
 else if(format==='usda'){data=exportUSD(s.positions,s.faces,s.worldMatricesMetresYUp.map(matrix),s.parents,s.names,s.rig4,0);mime='text/plain';extension='usda';}
 else if(format==='snapshot'){data=JSON.stringify({...s,positions:Array.from(s.positions),faces:Array.from(s.faces),joints:Array.from(s.joints),rig4:{indices:Array.from(s.rig4.indices),weights:Array.from(s.rig4.weights)}},null,2);mime='application/json';extension='json';}
 else throw Error('Unknown common export format');
 return{data,mime,filename:'common-person-posed-snapshot.'+extension,scope:s.notes,weightReduction:s.weightReduction};
}
