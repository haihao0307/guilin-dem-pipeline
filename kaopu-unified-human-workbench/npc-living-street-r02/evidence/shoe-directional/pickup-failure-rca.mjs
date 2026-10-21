import fs from 'node:fs';
import path from 'node:path';
import {THREE} from '../../src/NativeBinding.mjs';
import {actorFor} from '../shoe-recovery/native-actor.mjs';
import {fitNativeShoeSide} from '../../src/NativeShoes.mjs';
import {createNativeShoeField as oldBaseField,createNativeShoeApertureField as oldAperture} from './NativeShoeFit-baseline-importable.mjs';
import {MeshContact} from '../../vendor/appearance/cloth-adapted/mesh-contact.mjs';
const root=globalThis.__SHOE_QA_ROOT__,cache=JSON.parse(fs.readFileSync(path.join(root,'evidence/CAPTURE_RECOVERY_CHAIN_SIX_FINAL_POSES.json'))),audit=JSON.parse(fs.readFileSync(path.join(root,'evidence/shoe-directional/PICKUP_ACTUAL_294_SHOES.json'))),rows=[];
const transform=(m,p)=>[0,1,2].map(k=>m[k*4]*p[0]+m[k*4+1]*p[1]+m[k*4+2]*p[2]+m[k*4+3]);
function poseBody(actor,pose){const out=new Float64Array(actor.nativeSource.positions.length),range=actor.binding.displayRange,P=actor.binding.displayPacked;
 for(let i=0;i<actor.nativeSource.bodyCount;i++)for(let n=0;n<range[i*4+1];n++){
  const k=(range[i*4]+n)*8,m=pose.skinMatrices[P[k+3]],v=transform(m,[P[k],P[k+1],P[k+2]]);for(let j=0;j<3;j++)out[i*3+j]+=P[k+4]*v[j];
 }return out;
}
for(const id of (process.env.ACTOR_IDS||cache.actorIds.join(',')).split(',')){
 const choices=audit.rows.filter(r=>r.actor===id),worst=choices.reduce((a,b)=>!a||b.minimumM<a.minimumM?b:a,null);if(!worst)continue;
 const actor=actorFor(id),fit=fitNativeShoeSide(actor,worst.side),base=oldBaseField(fit.foot,fit.sourceModel.last,{scaleM:fit.scaleM,centerF:fit.field.centerF,centerR:fit.field.centerR}),old=oldAperture(actor,fit.sourceModel,base,fit.foot);
 const pose=cache.samples.find(p=>p.actor===id&&p.frame===worst.frame&&p.token===worst.token),P=poseBody(actor,pose),body=new MeshContact(P,actor.nativeSource.faces),neutral=new MeshContact(actor.nativeSource.positions,actor.nativeSource.faces),part=fit.sourceModel.parts.find(p=>p.id===worst.worst.part),g=part.geometry,I=g.index.array;
 let ids,weights;if(worst.worst.kind==='vertex'){ids=[worst.worst.vertex];weights=[1];}
 else if(worst.worst.kind==='edge'){ids=worst.worst.edge;weights=[.5,.5];}
 else{ids=Array.from(I.subarray(worst.worst.triangle*3,worst.worst.triangle*3+3));weights=[1/3,1/3,1/3];}
 const native=p=>{const r=fit.field.mirror*p[0]*fit.scaleM+fit.field.centerR,f=p[2]*fit.scaleM+fit.field.centerF;return[fit.foot.foot[0]+fit.foot.right[0]*r+fit.foot.forward[0]*f,fit.foot.foot[1]+fit.foot.right[1]*r+fit.foot.forward[1]*f,p[1]*fit.scaleM+fit.field.baseZ];};
 const getPoint=field=>{const p=[0,0,0];for(let i=0;i<ids.length;i++){const v=ids[i],q=field.evaluate([g.attributes.position.getX(v),g.attributes.position.getY(v),g.attributes.position.getZ(v)]).p;for(let k=0;k<3;k++)p[k]+=weights[i]*Math.fround(q[k]);}return native(p);};
 const now=getPoint(fit.field),before=getPoint(old),matrix=pose.skinMatrices[fit.foot.footId],currentPose=transform(matrix,now),oldPose=transform(matrix,before),q=new Float64Array(4),query=(contact,p)=>{const face=contact.nearest(...p);contact.evaluate(face,...p,q);return{signedDistanceM:q[0],face:face/3,normal:Array.from(q.subarray(1)),point:p};};
 const inverse=new THREE.Matrix4().fromArray(matrix).transpose().invert(),bodyVertices=worst.worst.bodyVertices.map(id=>{
  const p=Array.from(P.subarray(id*3,id*3+3)),r=new THREE.Vector3(...p).applyMatrix4(inverse),rest=Array.from(actor.nativeSource.positions.subarray(id*3,id*3+3)),influences=[];
  for(let j=0;j<actor.binding.displayRange[id*4+1];j++){const k=(actor.binding.displayRange[id*4]+j)*8;influences.push({bone:actor.rig.names[actor.binding.displayPacked[k+3]],weight:actor.binding.displayPacked[k+4]});}
  return{id,neutralNative:rest,posedNative:p,posedRelativeToFootSkin:[r.x,r.y,r.z],motionRelativeToFootM:[r.x-rest[0],r.y-rest[1],r.z-rest[2]],influences};
 });
 const row={actor:id,side:worst.side,frame:pose.frame,poseIndex:worst.poseIndex,phase:pose.phase,sourceFrame:pose.sourceFrame,part:part.id,kind:worst.worst.kind,sourceVertexIds:ids,
  currentNeutral:query(neutral,now),oldNeutral:query(neutral,before),currentActual:query(body,currentPose),oldActual:query(body,oldPose),
  pointChangeM:Math.hypot(...now.map((v,k)=>v-before[k])),bodyVertices};rows.push(row);console.log(JSON.stringify(row));
}
fs.writeFileSync(path.join(root,'evidence/shoe-directional/PICKUP_FAILURE_DIRECTIONAL_VS_BASELINE.json'),JSON.stringify({schema:'same-actual-pose-shoe-clearance-failure-comparison/1',sourceHashes:globalThis.__SHOE_QA_SOURCE_HASHES__,
 description:'Exactly one actually sampled worst pose per actor. Current directional sample and original height-only radial sample are evaluated against the identical full posed-body mesh. Baseline adapter only replaces its relative MeshContact import path; baseline calculations are unchanged.',rows,passed:false},null,2)+'\n');
