import fs from 'node:fs';
import path from 'node:path';
import {THREE} from '../../src/NativeBinding.mjs';
import {actorFor} from '../shoe-recovery/native-actor.mjs';
import {fitNativeShoeSide} from '../../src/NativeShoes.mjs';
const root=globalThis.__SHOE_QA_ROOT__,cache=JSON.parse(fs.readFileSync(path.join(root,'evidence/CAPTURE_RECOVERY_CHAIN_SIX_FINAL_POSES.json'))),rows=[];
for(const id of ['C','E']){const actor=actorFor(id);for(const side of ['L','R']){
 const fit=fitNativeShoeSide(actor,side),record=fit.record,e=record.footLocalEnvelope,H=e.hullRF;let vertices=0,maximumHullOutsideM=0,maximumHeightOutsideM=0,maximumBoundsOutsideM=0,maximumReconstructionM=0;
 for(const part of fit.model.parts){const P=part.geometry.attributes.position;for(let i=0;i<P.count;i++){
  const q=new THREE.Vector3(P.getX(i)*(side==='L'?-fit.scaleM:fit.scaleM),P.getY(i)*fit.scaleM,P.getZ(i)*fit.scaleM).applyMatrix4(fit.restNative),p=[q.x,q.y,q.z],d=p.map((v,k)=>v-e.originNative[k]),r=d.reduce((s,v,k)=>s+v*e.rightNative[k],0),f=d.reduce((s,v,k)=>s+v*e.forwardNative[k],0),z=d[2];vertices++;
  for(let k=0;k<H.length;k++){const a=H[k],b=H[(k+1)%H.length],x=b[0]-a[0],y=b[1]-a[1],cross=x*(f-a[1])-y*(r-a[0]);maximumHullOutsideM=Math.max(maximumHullOutsideM,-cross/Math.hypot(x,y));}
  maximumHeightOutsideM=Math.max(maximumHeightOutsideM,e.heightRangeM[0]-z,z-e.heightRangeM[1]);
  for(let k=0;k<3;k++){maximumBoundsOutsideM=Math.max(maximumBoundsOutsideM,record.fullNativeBounds.min[k]-p[k],p[k]-record.fullNativeBounds.max[k]);const v=e.originNative[k]+e.rightNative[k]*r+e.forwardNative[k]*f+(k===2?z:0);maximumReconstructionM=Math.max(maximumReconstructionM,Math.abs(v-p[k]));}
 }}
 const previous=cache.shoes[id].perSide[side],current=record.solePointsNative,soleExactlyEqual=current.length===previous.solePointsNative.length&&current.every((p,i)=>p.every((v,k)=>v===previous.solePointsNative[i][k]));
 rows.push({actor:id,side,vertices,parts:fit.model.parts.length,hullPoints:H.length,maximumHullOutsideM,maximumHeightOutsideM,maximumBoundsOutsideM,maximumReconstructionM,soleVertices:current.length,soleExactlyEqual,soleLiftExactlyEqual:record.soleLiftM===previous.soleLiftM});
}}
const data={schema:'complete-native-shoe-planning-envelope-metadata-check/1',sourceHashes:globalThis.__SHOE_QA_SOURCE_HASHES__,rows,
 checked:'Every actual current original part vertex, including collar/tongue/metal/lace, against the exported RF convex prism and native AABB; same native construction point reconstruction; all original sole points against the unchanged actual chain cache.',
 passed:rows.every(r=>r.maximumHullOutsideM<1e-12&&r.maximumHeightOutsideM===0&&r.maximumBoundsOutsideM===0&&r.maximumReconstructionM<1e-12&&r.soleExactlyEqual&&r.soleLiftExactlyEqual),
 limitation:'Neutral wearer geometry metadata only. Dynamic upper poses may require a new observed envelope; this is not a shoe-crossing path or collision pass.'};
fs.writeFileSync(path.join(root,'evidence/shoe-directional/ENVELOPE_METADATA_CE.json'),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data));if(!data.passed)throw Error('Exported complete-shoe envelope inconsistent');
