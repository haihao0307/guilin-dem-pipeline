import fs from 'node:fs';
import path from 'node:path';
import {loadNativeBodyFixture} from '../native-body-fixtures.mjs';
import {THREE,NativeBinding} from '../../src/NativeBinding.mjs';
import {NativeRig} from '../../src/NativeRig.mjs';
import {fitNativeShoeSide} from '../../src/NativeShoes.mjs';
import {buildSurface,inspectOrientation,dot,sub} from './geometry-audit.mjs';
const root=globalThis.__SHOE_QA_ROOT__,ids=(process.env.ACTOR_IDS||'F,A,B,C,D,E').split(','),rows=[];
function actorFor(id){
 const model=loadNativeBodyFixture(id),geometry=new THREE.BufferGeometry(),P=new Float32Array(model.positions.length);
 for(let i=0;i<model.bodyCount;i++){P[i*3]=model.positions[i*3];P[i*3+1]=model.positions[i*3+2];P[i*3+2]=-model.positions[i*3+1];}
 geometry.setAttribute('position',new THREE.BufferAttribute(P,3));geometry.setIndex(new THREE.BufferAttribute(model.faces.slice(),1));geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial()),ocular={source:geometry,geometry,pairs:[]};
 const binding=new NativeBinding(model,{mesh,geometry,currentOcular:ocular,surfaces:new Map([['body-prefix',{geometry,levels:[]}]])});
 const rig=new NativeRig(binding.rig);return{id,rig,binding,nativeSource:{positions:binding.positions,faces:model.faces,bodyCount:model.bodyCount},fixture:{bodyVertices:model.bodyCount,bodyTriangles:model.faces.length/3,bones:rig.count,csrInfluences:binding.packed.length/8}};
}
for(const id of ids){const actor=actorFor(id);for(const side of ['L','R']){
 const start=performance.now(),fit=fitNativeShoeSide(actor,side),surface=buildSurface(fit),insole=buildSurface(fit,'insole'),orientation=inspectOrientation(fit),records=[];
 for(const row of fit.foot.allSamples){
  const p=[fit.field.mirror*(row.r-fit.field.centerR)/fit.scaleM,(row.p[2]-fit.field.baseZ)/fit.scaleM,(row.f-fit.field.centerF)/fit.scaleM],s=p[2]/fit.model.last.L+.5;
  const upper=surface.nearest(p),bottom=insole.nearest(p);
  records.push({id:row.id,station:s,pointMm:p,nativeZ:row.p[2],heightAboveAnkleM:row.p[2]-fit.foot.foot[2],footWeight:row.footWeight,outsideFootWeights:row.outsideFootWeights,upper:{...upper,signedDistanceM:upper.signedDistanceMm*fit.scaleM},insole:{...bottom,signedDistanceM:bottom.signedDistanceMm*fit.scaleM}});
 }
 const sourceByPart=fit.sourceModel.parts.map(p=>({id:p.id,triangles:p.geometry.index.count/3,vertices:p.geometry.attributes.position.count}));
 const sizingIds=new Set(fit.foot.samples.map(p=>p.id)),forefoot=records.filter(r=>r.station>=.328&&sizingIds.has(r.id));
 const rawWorst=records.slice().sort((a,b)=>a.upper.signedDistanceM-b.upper.signedDistanceM),frontWorst=forefoot.slice().sort((a,b)=>a.upper.signedDistanceM-b.upper.signedDistanceM);
 const minimum=(a,k)=>Math.min(...a.map(r=>r[k].signedDistanceM));
 const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(const part of fit.model.parts){const P=part.geometry.attributes.position.array;for(let i=0;i<P.length;i++){const k=i%3;bounds.min[k]=Math.min(bounds.min[k],P[i]*fit.scaleM);bounds.max[k]=Math.max(bounds.max[k],P[i]*fit.scaleM);}}
 const result={actor:id,side,fixture:actor.fixture,sourceByPart,sourceParts:sourceByPart.length,sourceTriangles:fit.record.sourceTriangles,soleVertices:fit.record.solePointsNative.length,
  fitting:fit.model.report.wearerFit,foot:{lengthM:fit.foot.length,widthM:fit.foot.width,sizingSamples:fit.foot.samples.length,allNonzeroFootSamples:fit.foot.allSamples.length},boundsM:bounds,
  upper:{innerTriangles:surface.triangles.length,rawAllFootMinimumM:minimum(records,'upper'),rawAllFootNegativeCount:records.filter(r=>r.upper.signedDistanceM<0).length,forefootMinimumM:minimum(forefoot,'upper'),forefootBelow1mm:forefoot.filter(r=>r.upper.signedDistanceM<.001).length,worstAll:rawWorst.slice(0,12),worstForefoot:frontWorst.slice(0,12)},
  insole:{triangles:insole.triangles.length,minimumM:minimum(records,'insole')},orientation,elapsedMS:performance.now()-start,
  limitations:['Raw all-foot closest-inner signed distances include the actual open ankle and are not a closed-solid inside certificate.','Forefoot subset is a bounded covered-toe diagnostic, not a final whole-shoe clearance pass.','No motion or rendered material acceptance in this first recovery diagnostic.']};
 rows.push(result);fs.writeFileSync(path.join(root,'evidence/shoe-recovery/'+(process.env.SHOE_QA_OUTPUT||'GEOMETRY_FIRST_'+ids.join(''))+'.json'),JSON.stringify({schema:'recovered-native-shoe-geometry-first/1',sourceHashes:globalThis.__SHOE_QA_SOURCE_HASHES__,rows,passed:false,complete:rows.length===ids.length*2},null,2)+'\n');
 console.log(JSON.stringify({actor:id,side,parts:result.sourceParts,triangles:result.sourceTriangles,sole:result.soleVertices,maxMoveM:result.fitting.maximumDisplacementMm*fit.scaleM,orientationDisagreements:orientation.transportedNormalDisagreements,byPart:orientation.byPart,forefootMinimumM:result.upper.forefootMinimumM,rawAllFootMinimumM:result.upper.rawAllFootMinimumM,insoleMinimumM:result.insole.minimumM,ms:result.elapsedMS}));
 for(const part of fit.model.parts)part.geometry.dispose();for(const part of fit.sourceModel.parts)part.geometry.dispose();
}}
