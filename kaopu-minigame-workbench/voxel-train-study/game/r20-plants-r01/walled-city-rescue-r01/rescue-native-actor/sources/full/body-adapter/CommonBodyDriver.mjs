import {I,mul,inv,point} from './math.mjs';

const matrices=(flat,n)=>Array.from({length:n},(_,i)=>Array.from(flat.slice(i*16,i*16+16)));
const cloneVector=(v,n,name)=>{const a=v===undefined?Array(n).fill(0):Array.from(v);if(a.length!==n||!a.every(Number.isFinite))throw Error('Invalid '+name);return a;};
const isIdentity=m=>m.every((v,i)=>v===I()[i]);

/** Independent fixed-body driver. No head geometry, seam repair, persistent-state
 * mutation, or parent State/CommonPerson changes. Both rigs emit the same ordered
 * 9,253 body vertices. MHR identity is common shape; articulation is source-owned.
 */
export class CommonBodyDriver {
 constructor({anny,mhrAdapter,canonical}={}) {
  if(!mhrAdapter)throw Error('A validated MHR R1 body adapter is required');
  this.mhr=mhrAdapter;this.anny=anny||mhrAdapter.anny;this.canonical=canonical||mhrAdapter.canonical;
  this.bodyCount=this.canonical.annyRecipes.length;
  if(this.bodyCount!==9253||this.bodyCount!==mhrAdapter.bodyCount||this.canonical.topologySha256!==mhrAdapter.canonical.topologySha256)throw Error('Fixed canonical body mismatch');
  this.annyCranial=new Set(this.anny.boneLabels.flatMap((n,j)=>/^neck\d+$/.test(n)||n==='head'||n==='eye.L'||n==='eye.R'?[j]:[]));
  const neck=this.mhr.names.indexOf('c_neck');this.mhrCranial=new Set();
  for(let j=0;j<this.mhr.names.length;j++){let p=j;while(p>=0){if(p===neck){this.mhrCranial.add(j);break;}p=this.mhr.parents[p];}}
  // Preserve every original Anny recipe/source influence, and aggregate only
  // equal joint columns. Its conditioned point is assembled after shape evaluation.
  this.annyEntries=[];const ptr=[0],joints=[],weights=[];
  for(const [u,v,t]of this.canonical.annyRecipes){
   const entries=[],row=new Map();for(const[source,b]of[[u,1-t],[v,t]])if(b)for(let k=0;k<this.anny.influences;k++){
    const slot=source*this.anny.influences+k,j=this.anny.arrays.vertex_bone_indices[slot],w=b*this.anny.arrays.vertex_bone_weights[slot];if(w===0)continue;entries.push({source,j,w});row.set(j,(row.get(j)||0)+w);
   }
   this.annyEntries.push(entries);for(const[j,w]of [...row].sort((a,b)=>a[0]-b[0])){joints.push(j);weights.push(w);}ptr.push(joints.length);
  }
  this.annyWeights={ptr:new Uint32Array(ptr),joints:new Uint16Array(joints),values:new Float64Array(weights),truncated:false,normalization:'Original Anny weights preserved; no pruning or renormalization'};
 }
 sampleAnny(v){const out=new Float32Array(this.bodyCount*3);this.canonical.annyRecipes.forEach(([a,b,t],i)=>{for(let c=0;c<3;c++)out[i*3+c]=v[a*3+c]*(1-t)+v[b*3+c]*t;});return out;}
 effectiveAnnyPose(state,headRig){
  const pose={},saved=state.anny?.pose||{},translations=state.anny?.translations||{};
  for(const name of new Set([...Object.keys(saved),...Object.keys(translations)])){
   const j=this.anny.boneLabels.indexOf(name);if(j<0)throw Error('Unknown Anny bone '+name);
   if(headRig==='gnm'&&this.annyCranial.has(j))continue;
   const entry=saved[name],rotation=cloneVector(entry?.rotation||entry,3,'Anny rotation '+name),translation=cloneVector(translations[name]||entry?.translation,3,'Anny translation '+name);
   pose[name]={rotation,translation};
  }return pose;
 }
 /** Factor the true native Anny bind contribution for each CSR joint. Using the
  * already-blended zero-pose vertex here is incorrect at newborn/baby anchors:
  * zero-pose bone transforms are not one common rigid transform at those ages. */
 annyRestPacket(zero,sharedDelta){
  const w=this.annyWeights,positions=new Float64Array(w.values.length*3),zeroNative=matrices(zero.boneTransforms,this.anny.boneCount);
  for(let i=0;i<this.bodyCount;i++){
   const slots=new Map();for(let k=w.ptr[i];k<w.ptr[i+1];k++)slots.set(w.joints[k],k);
   for(const{source,j,w:weight}of this.annyEntries[i]){
    const p=point(zeroNative[j],Array.from(zero.restVertices.slice(source*3,source*3+3))),slot=slots.get(j),fraction=weight/w.values[slot];
    for(let c=0;c<3;c++)positions[slot*3+c]+=fraction*p[c];
   }
   for(let k=w.ptr[i];k<w.ptr[i+1];k++)for(let c=0;c<3;c++)positions[k*3+c]+=sharedDelta[i*3+c];
  }
  return{schema:'anny-body-joint-conditioned-rest/1',vertexCount:this.bodyCount,weights:w,restPositionsPerInfluence:positions,coordinateSystem:'common target-rest metre Z-up; native Anny zero-pose contribution conditioned on joint'};
 }
 skinAnnyPacket(packet,skin){
  const out=new Float32Array(this.bodyCount*3),w=packet.weights,p=packet.restPositionsPerInfluence;
  for(let i=0;i<this.bodyCount;i++){const v=[0,0,0];for(let k=w.ptr[i];k<w.ptr[i+1];k++){const q=point(skin[w.joints[k]],Array.from(p.slice(k*3,k*3+3)));for(let c=0;c<3;c++)v[c]+=w.values[k]*q[c];}out.set(v,i*3);}return out;
 }
 evaluate(state,{gnmRootRestMatrix=null}={}) {
  const t=performance.now(),owners={rig:state.owners?.rig||'anny',headRig:state.owners?.headRig||'gnm',expression:state.owners?.expression||'gnm'};
  if(!['anny','mhr'].includes(owners.rig)||!['gnm','body'].includes(owners.headRig)||!['gnm','anny','mhr'].includes(owners.expression))throw Error('Unsupported body-driver ownership');
  const G=owners.headRig==='gnm'&&gnmRootRestMatrix?Array.from(gnmRootRestMatrix):I();
  if(G.length!==16||!G.every(Number.isFinite)||G[12]!==0||G[13]!==0||G[14]!==0||G[15]!==1)throw Error('Invalid common-rest GNM root matrix');
  const activeG=!isIdentity(G),shape={phenotypes:structuredClone(state.anny?.phenotypes||this.canonical.referenceAnnyPhenotypes),localChanges:structuredClone(state.anny?.localChanges||{})};
  const identity=cloneVector(state.mhr?.identity,45,'MHR identity'),expression=owners.expression==='mhr'?cloneVector(state.mhr?.expression,72,'MHR expression'):Array(72).fill(0);
  const shapeNative={identity,expression,pose:Array(204).fill(0),correctives:false};
  // This deliberately ignores saved native articulation while preserving the
  // shared 45-dimensional MHR identity and the active MHR expression rest field.
  const shared=this.mhr.evaluate(shapeNative,shape),sharedRest=shared.vertices;
  let vertices,names,parents,rest,posed,skin,originalSkin,packet,cranial,nativeResult,effectivePose;
  if(owners.rig==='mhr'){
   const pose=cloneVector(state.mhr?.pose,204,'MHR pose');if(owners.headRig==='gnm')for(let i=24;i<=29;i++)pose[i]=0;
   const effective={identity,expression,pose,correctives:state.mhr?.correctives!==false};
   nativeResult=this.mhr.evaluate(effective,shape);packet=this.mhr.influenceRestPacket(nativeResult);
   names=this.mhr.names;parents=this.mhr.parents;rest=nativeResult.targetRestMatrices;originalSkin=nativeResult.skinMatrices;cranial=this.mhrCranial;
   skin=originalSkin.map((m,j)=>activeG&&cranial.has(j)?mul(m,G):m.slice());posed=skin.map((m,j)=>mul(m,rest[j]));
   vertices=activeG?this.mhr.skinInfluenceRestPacket(packet,{skinMatrices:skin}):nativeResult.vertices.slice();effectivePose=effective;
  }else{
   const zero=this.anny.forward(shape),pose=this.effectiveAnnyPose(state,owners.headRig),native=this.anny.forward({...shape,pose});
   names=this.anny.boneLabels;parents=this.anny.boneParents;rest=matrices(zero.bonePoses,this.anny.boneCount);const nativePosed=matrices(native.bonePoses,this.anny.boneCount);
   originalSkin=nativePosed.map((m,j)=>mul(m,inv(rest[j])));cranial=this.annyCranial;
   skin=originalSkin.map((m,j)=>activeG&&cranial.has(j)?mul(m,G):m.slice());posed=skin.map((m,j)=>mul(m,rest[j]));
   packet=this.annyRestPacket(zero,shared.shapeDisplacement);
   const zeroPose=Object.values(pose).every(v=>[...v.rotation,...v.translation].every(x=>x===0)),zeroDelta=shared.shapeDisplacement.every(v=>v===0);
   // Preserve the official teacher's Float32 vertex rounding exactly whenever
   // the factored form reduces to an already-evaluated native/rest result.
   if(!activeG&&zeroPose)vertices=sharedRest.slice();
   else if(!activeG&&zeroDelta)vertices=this.sampleAnny(native.vertices);
   else vertices=this.skinAnnyPacket(packet,skin);
   nativeResult={zero,posed:native,identityRestSource:shared.native};effectivePose=pose;
  }
  if(vertices.length!==this.bodyCount*3||!vertices.every(Number.isFinite))throw Error('Invalid canonical body output');
  packet={...packet,targetRestMatrices:rest,targetPosedMatrices:posed,skinMatrices:skin,names,parents,topologySha256:this.canonical.topologySha256};
  const attachment={};for(const alias of ['neck02','head']){
   const name=owners.rig==='anny'?alias:(alias==='neck02'?'c_neck_twist1_proc':'c_head'),j=names.indexOf(name);
   if(j<0)throw Error('Missing attachment '+name);
   attachment[alias]={index:j,sourceJoint:name,skin:skin[j],bodySkin:originalSkin[j],originalSkin:originalSkin[j],rest:rest[j],posed:posed[j],worldScale:Math.hypot(posed[j][0],posed[j][4],posed[j][8]),approximation:owners.rig==='mhr'&&alias==='neck02'?'MHR has no native neck02; this is its neck twist midpoint frame, not an identical Anny pivot':null};
  }
  const rig={source:owners.rig,names,parents:Array.from(parents),weights:packet.weights,restMatrices:rest,posedMatrices:posed,skinMatrices:skin,originalSkinMatrices:originalSkin,cranialIndices:[...cranial],restPositionsPerInfluence:packet.restPositionsPerInfluence,matrixConvention:'row-major matrices acting on column vectors; metre Z-up',snapshotInverseBindMatrices:posed.map(inv)};
  return{schema:'common-body-driver/1',vertices,positions:vertices,bodyCount:this.bodyCount,topologySha256:this.canonical.topologySha256,owners,sharedRestVertices:sharedRest.slice(),baseAnnyRestVertices:shared.restVertices.slice(),sharedRestDisplacement:shared.shapeDisplacement.slice(),rig,packet,attachment,attachmentSkinMatrices:{neck02:attachment.neck02.skin,head:attachment.head.skin},attachmentBodySkinMatrices:{neck02:attachment.neck02.bodySkin,head:attachment.head.bodySkin},effectiveInputs:{shape,mhr:owners.rig==='mhr'?effectivePose:shapeNative,annyPose:owners.rig==='anny'?effectivePose:{}},gnmRootApplied:activeG,gnmRootOrder:'finalSkin = bodySkin × G_common_rest on cranial influences',nativeResult,headGeometryEvaluated:false,neckRepairApplied:false,evaluationMs:performance.now()-t};
 }
 /** Static evaluated body plus the exact selected posed skeleton. The posed
  * snapshot bind prevents a second deformation of already-baked positions. */
 exportSnapshot(result){return{schema:'common-body-driver-snapshot/1',topologySha256:result.topologySha256,bodyCount:this.bodyCount,vertices:Array.from(result.vertices),rigOwner:result.owners.rig,names:result.rig.names,parents:result.rig.parents,jointWorld:result.rig.posedMatrices,snapshotInverseBindWorld:result.rig.snapshotInverseBindMatrices,referenceBindWorld:result.rig.restMatrices,weights:{ptr:Array.from(result.rig.weights.ptr),joints:Array.from(result.rig.weights.joints),values:Array.from(result.rig.weights.values)},attachment:result.attachment,notes:'Baked posed body. Re-evaluate the selected native driver and dynamic corrective fields for further animation.'};}
}
