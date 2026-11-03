import fs from 'node:fs';
import path from 'node:path';
import {THREE} from '../src/NativeBinding.mjs';
import {createMotionRecoveryFixture} from './NativeMotionRecoveryFixture.mjs';
const root=globalThis.__CAPTURE_QA_ROOT__,boundary=JSON.parse(fs.readFileSync(path.join(root,'evidence/CAPTURE_ENTRY_BOUNDARIES_CED.json'))),ids=(process.env.ACTOR_IDS||'C,E,D').split(','),rows=[],states=[],geometries=[];
const transform=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[2]*p[2]+m[3],m[4]*p[0]+m[5]*p[1]+m[6]*p[2]+m[7],m[8]*p[0]+m[9]*p[1]+m[10]*p[2]+m[11]];
const hull=raw=>{const P=raw.map(p=>[p[0],p[1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),L=[],U=[];for(const p of P){while(L.length>=2&&cross(L.at(-2),L.at(-1),p)<=0)L.pop();L.push(p);}for(const p of P.slice().reverse()){while(U.length>=2&&cross(U.at(-2),U.at(-1),p)<=0)U.pop();U.push(p);}return L.slice(0,-1).concat(U.slice(0,-1));};
function gap(A,B){let best=-Infinity;for(const P of[A,B])for(let i=0;i<P.length;i++){const e=[P[(i+1)%P.length][0]-P[i][0],P[(i+1)%P.length][1]-P[i][1]],len=Math.hypot(...e);if(len<1e-12)continue;const n=[-e[1]/len,e[0]/len],a=A.map(p=>p[0]*n[0]+p[1]*n[1]),b=B.map(p=>p[0]*n[0]+p[1]*n[1]);best=Math.max(best,Math.min(...a)-Math.max(...b),Math.min(...b)-Math.max(...a));}return best;}
for(const id of ids){
 const actor=await createMotionRecoveryFixture(id,{notify:console.log}),m=actor.motion,r=actor.rig,source=boundary.observations.find(x=>x.actor===id&&x.stage==='before'),input=source.input;
 const stance=m.assessPickupStance();if(!stance.passed)throw Error('Current original shoes lost contact stance '+id);
 const shoeNative={},shoeFaces={},footIds={};
 for(const side of ['L','R']){
  const fit=actor.fixture.shoeFits[side],points=[],faces=[];for(const part of fit.model.parts){const P=part.geometry.attributes.position,offset=points.length;for(let i=0;i<P.count;i++){const v=new THREE.Vector3(P.getX(i)*(side==='L'?-fit.scaleM:fit.scaleM),P.getY(i)*fit.scaleM,P.getZ(i)*fit.scaleM).applyMatrix4(fit.restNative);points.push([v.x,v.y,v.z]);}for(const j of part.geometry.index.array)faces.push(j+offset);}
  shoeNative[side]=points;shoeFaces[side]=faces;footIds[side]=[];
  for(let v=0;v<actor.binding.N;v++){let weight=0;for(let j=0;j<actor.binding.displayRange[v*4+1];j++){const k=(actor.binding.displayRange[v*4]+j)*8,name=r.names[actor.binding.displayPacked[k+3]];if((name.startsWith('foot.')||name.startsWith('toe'))&&name.endsWith('.'+side))weight+=actor.binding.displayPacked[k+4];}if(weight>=.5)footIds[side].push(v);}
 }
 for(let j=0;j<104;j++){r.skinMatrices[j].set(source.skinMatrices[j]);r.posedMatrices[j].set(source.posedMatrices[j]);r.rotationDeltas[j].splice(0,3,...source.rotationDeltas[j]);}r.rootTranslation.splice(0,3,...source.rootTranslation);
 // NativeMotion stores the unwrapped navigation yaw in root.rotation.y.
 // Restoring only its quaternion chooses Three's principal Euler branch for
 // yaw > pi/2 and would change _start's oldYaw even with equal world matrices.
 actor.root.position.set(...source.rootWorld);actor.root.rotation.set(0,source.rootYaw,0);actor.root.updateMatrixWorld(true);
 if(Math.max(...actor.root.quaternion.toArray().map((v,k)=>Math.abs(v-source.rootQuaternion[k])))>1e-12)throw Error('Actual prior root orientation was not restored');
 m.lastInput=structuredClone(source.lastInput);m.lastFeet=structuredClone(source.lastFeet);m.lastMode=source.lastMode;m.lastReport=structuredClone(source.lastReport);m.pickup.reset();
 const summary={actor:id,sourceFrame:source.frame,sourceYaw:source.rootYaw,destinationYaw:input.yaw,originalSupport:Object.fromEntries(Object.entries(source.lastFeet).map(([s,f])=>[s,f.planted])),minimumOppositeFootShoeProjectedGapM:Infinity,minimumShoesProjectedGapM:Infinity,maximumBoneLengthErrorM:0,maximumFootErrorM:0,minimumSoleM:Infinity,maximumPlantedSoleM:-Infinity,invalid:0,frames:[]};
 for(let frame=0;frame<120;frame++){
  const report=m.update({...input,mode:'pickup',dt:1/60,time:(source.frame+frame+1)/60,grip:0,graspProfile:'bottle',pickupAttached:false});if(report.stage!=='entry')break;
  const body=Array.from({length:actor.binding.N},(_,v)=>actor.poseTools.sampleVertex(v)),shoes=Object.fromEntries(['L','R'].map(s=>[s,shoeNative[s].map(p=>transform(r.skinMatrices[r.limbs['leg'+s].c],p))])),polys=Object.fromEntries(['L','R'].map(s=>[s,hull(shoes[s].map(p=>[p[0],p[1]]))])),bodyPolys=Object.fromEntries(['L','R'].map(s=>[s,hull(footIds[s].map(v=>[body[v][0],body[v][1]]))]));
  const opposite={L:gap(polys.L,bodyPolys.R),R:gap(polys.R,bodyPolys.L)},shoeGap=gap(polys.L,polys.R);
  const row={frame:source.frame+frame,localFrame:frame,elapsed:m.pickup.elapsed,order:m.pickup.entry.plan.order,feet:report.feet,oppositeFootShoeProjectedGapM:opposite,shoesProjectedGapM:shoeGap,poseValid:report.poseValid,boneLengthErrorM:report.boneLengthErrorM,footErrorM:report.footErrorM,rootTranslation:r.rootTranslation.slice()};summary.frames.push(row);
  summary.minimumOppositeFootShoeProjectedGapM=Math.min(summary.minimumOppositeFootShoeProjectedGapM,...Object.values(opposite));summary.minimumShoesProjectedGapM=Math.min(summary.minimumShoesProjectedGapM,shoeGap);summary.maximumBoneLengthErrorM=Math.max(summary.maximumBoneLengthErrorM,report.boneLengthErrorM);summary.maximumFootErrorM=Math.max(summary.maximumFootErrorM,report.footErrorM);summary.invalid+=!report.poseValid;
  for(const f of Object.values(report.feet)){summary.minimumSoleM=Math.min(summary.minimumSoleM,f.soleMinimumWorldYM);if(f.planted)summary.maximumPlantedSoleM=Math.max(summary.maximumPlantedSoleM,f.soleMinimumWorldYM);}
  states.push({actor:id,frame:source.frame+frame,localFrame:frame,phase:report.stage,sourceFrame:0,skinMatrices:r.skinMatrices.map(x=>Array.from(x)),posedMatrices:r.posedMatrices.map(x=>Array.from(x)),rootTranslation:r.rootTranslation.slice(),rootWorld:actor.root.position.toArray(),rootMatrix:Array.from(actor.root.matrixWorld.elements),feet:report.feet});
  if(frame===0||frame===13||frame===18||frame===32)geometries.push({id:id+'-entry-'+frame,actor:id,frame:source.frame+frame,positions:body.flat(),faces:Array.from(actor.nativeSource.faces),shoes:Object.fromEntries(['L','R'].map(s=>[s,{positions:shoes[s].flat(),faces:shoeFaces[s]}])),feet:report.feet,rootWorld:actor.root.position.toArray()});
 }
 const plan=m.pickup.entry.plan;summary.plan={...plan,prism:undefined};summary.passed=summary.invalid===0&&summary.minimumOppositeFootShoeProjectedGapM>=0&&summary.minimumShoesProjectedGapM>=0&&summary.minimumSoleM>=-.003&&summary.maximumPlantedSoleM<=.003&&summary.maximumBoneLengthErrorM<=.00001;
 rows.push(summary);console.log(JSON.stringify({...summary,frames:summary.frames.length}));
}
const tag=process.env.RUN_TAG||'CANDIDATE_1',out=path.join(root,'evidence','CAPTURE_ENTRY_ROUTE_'+tag);
fs.writeFileSync(out+'.json',JSON.stringify({schema:'actual-entry-boundary-geometry-replay/1',scope:'Restores exact actual walk boundary. Candidate entry only, no new navigation, Cannon, receipt, held pose, or rendered-body claim.',sourceHashes:globalThis.__CAPTURE_QA_SOURCE_HASHES__,originalBoundarySHA256:'83c8b0d715a81052d1c4e0046eb0010151bb10a034acc4c7af00d3372f047868',rows,passed:rows.every(r=>r.passed)},null,2)+'\n');
fs.writeFileSync(out+'_POSES.json',JSON.stringify({schema:'native-entry-candidate-poses/1',states}));fs.writeFileSync(out+'_GEOMETRY.json',JSON.stringify({schema:'native-entry-candidate-depth-geometry/1',states:geometries}));
if(rows.some(r=>!r.passed))process.exitCode=2;
