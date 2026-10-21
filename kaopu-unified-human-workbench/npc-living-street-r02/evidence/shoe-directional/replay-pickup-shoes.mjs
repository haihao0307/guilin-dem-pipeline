/** Same actual successful pickup matrices; no motion synthesis or physics rerun. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {actorFor} from '../shoe-recovery/native-actor.mjs';
import {fitNativeShoeSide} from '../../src/NativeShoes.mjs';
import {MeshContact} from '../../vendor/appearance/cloth-adapted/mesh-contact.mjs';
import {buildSurface} from '../shoe-recovery/geometry-audit.mjs';
const root=globalThis.__SHOE_QA_ROOT__,relative='evidence/CAPTURE_RECOVERY_CHAIN_SIX_FINAL_POSES.json',bytes=fs.readFileSync(path.join(root,relative)),cache=JSON.parse(bytes);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),cacheHash=sha(bytes);
if(cacheHash!=='d86cb78585ccc95c8373eb234cda477ef31d9bc8a71ad674d6b03542332d5eaa')throw Error('Actual pickup pose cache changed');
const selected=(process.env.ACTOR_IDS||cache.actorIds.join(',')).split(','),rows=[],actors=[];
const output=path.join(root,'evidence/shoe-directional/PICKUP_ACTUAL_294_SHOES.json');
const transform=(m,x,y,z)=>[m[0]*x+m[1]*y+m[2]*z+m[3],m[4]*x+m[5]*y+m[6]*z+m[7],m[8]*x+m[9]*y+m[10]*z+m[11]];
function actualBody(actor,matrices,output){const range=actor.binding.displayRange,packed=actor.binding.displayPacked;
 for(let i=0;i<actor.nativeSource.bodyCount;i++){let x=0,y=0,z=0;
  for(let n=0;n<range[i*4+1];n++){
   const k=(range[i*4]+n)*8,m=matrices[packed[k+3]],w=packed[k+4],px=packed[k],py=packed[k+1],pz=packed[k+2];
   x+=w*(m[0]*px+m[1]*py+m[2]*pz+m[3]);y+=w*(m[4]*px+m[5]*py+m[6]*pz+m[7]);z+=w*(m[8]*px+m[9]*py+m[10]*pz+m[11]);
  }output[i*3]=x;output[i*3+1]=y;output[i*3+2]=z;
 }return output;
}
function innerSamples(fit){const records=[],seenVertices=new Set(),seenEdges=new Set();
 const add=(p,meta)=>{const r=fit.field.mirror*p[0]*fit.scaleM+fit.field.centerR,f=p[2]*fit.scaleM+fit.field.centerF;
  records.push({...meta,restNative:[fit.foot.foot[0]+fit.foot.right[0]*r+fit.foot.forward[0]*f,fit.foot.foot[1]+fit.foot.right[1]*r+fit.foot.forward[1]*f,p[1]*fit.scaleM+fit.field.baseZ]});};
 for(const kind of ['upper','insole'])for(const t of buildSurface(fit,kind).triangles){
  for(let k=0;k<3;k++){const key=t.part+'/'+t.ids[k];if(!seenVertices.has(key)){seenVertices.add(key);add(t.points[k],{part:t.part,kind:'vertex',vertex:t.ids[k],triangle:t.triangle});}}
  add([0,1,2].map(k=>(t.points[0][k]+t.points[1][k]+t.points[2][k])/3),{part:t.part,kind:'center',triangle:t.triangle});
  for(let k=0;k<3;k++){const j=(k+1)%3,a=t.ids[k],b=t.ids[j],key=t.part+'/'+Math.min(a,b)+'/'+Math.max(a,b);if(seenEdges.has(key))continue;seenEdges.add(key);add(t.points[k].map((x,i)=>(x+t.points[j][i])*.5),{part:t.part,kind:'edge',edge:[a,b],triangle:t.triangle});}
 }
 const seeds=new Int32Array(records.length).fill(-1);return{records,seeds};
}
function save(){const min=rows.reduce((v,r)=>Math.min(v,r.minimumM),Infinity),negative=rows.reduce((v,r)=>v+r.negativeCount,0),below=rows.reduce((v,r)=>v+r.below1mmCount,0);
 const data={schema:'actual-captured-pickup-complete-shoe-clearance-replay/1',sourceHashes:globalThis.__SHOE_QA_SOURCE_HASHES__,
  poseCache:{path:relative,sha256:cacheHash,source:cache.source,matrixSemantics:'Actual NativeRig Float64 row-major skin matrices, not the Float32 GPU upload; rootMatrix is original Three column-major.'},
  method:'Original NativeBinding full displayed-body CSR with both neutral residual corrections, all 9253 body points and all 18416 original triangles. For each unchanged actual pose, all current inner lining/insole vertices, triangle centres and unique edge midpoints are transformed by the actual foot skin matrix and queried against the complete posed body. The original MeshContact BVH is refitted without deleting a triangle. Previous closest faces are exact search upper-bound seeds only; every closer BVH candidate is still evaluated.',
  actors,rows,summary:{poses:rows.length/2,feet:rows.length,innerSamples:rows.reduce((n,r)=>n+r.samples,0),minimumM:Number.isFinite(min)?min:null,negativeCount:negative,below1mmCount:below,
   maximumSoleFloorReportErrorM:Math.max(0,...rows.map(r=>r.soleReportErrorM)),minimumSoleWorldYM:Math.min(Infinity,...rows.map(r=>r.soleMinimumWorldYM)),
   maximumPlantedSoleWorldYM:Math.max(-Infinity,...rows.filter(r=>r.planted).map(r=>r.soleMinimumWorldYM))},
  sampledShoeClearancePassed:rows.length===selected.length*49*2&&negative===0&&below===0,visualAcceptance:false,
  limitations:['49 actual noninterpolated poses per actor, selected by the original completed physical chain; no statement about unsampled instants.','Closest-normal sign on the original full body, matching the neutral sample audit; no continuous whole-triangle separation, global self-intersection or comfort certificate.','Native CPU geometry replay; original website materials, GPU rasterization and full-page visual acceptance remain pending.','Unchanged walk or other activities are not rerun or relabeled. The completed source chain remains bound to its original shoe hashes; this result is the narrower geometric replay.']};
 fs.writeFileSync(output,JSON.stringify(data,null,2)+'\n');
}
for(const id of selected){const started=performance.now(),actor=actorFor(id),fits={},samples={},bodyPositions=new Float64Array(actor.nativeSource.positions),body=new MeshContact(bodyPositions,actor.nativeSource.faces),poses=cache.samples.filter(p=>p.actor===id);
 if(poses.length!==49)throw Error('Expected exactly 49 actual pickup poses for '+id);
 for(const side of ['L','R']){fits[side]=fitNativeShoeSide(actor,side);samples[side]=innerSamples(fits[side]);
  const a=fits[side].record.solePointsNative,b=cache.shoes[id].perSide[side].solePointsNative;
  if(a.length!==9877||a.length!==b.length||a.some((p,i)=>p.some((v,k)=>v!==b[i][k])))throw Error('Complete actual sole changed before pose replay '+id+'/'+side);
 }
 actors.push({actor:id,bodyVertices:actor.nativeSource.bodyCount,bodyTriangles:actor.nativeSource.faces.length/3,bones:actor.rig.count,displayCSRInfluences:actor.binding.displayPacked.length/8,poses:poses.length,shoePartsPerSide:39,soleVerticesPerSide:9877});
 for(let poseIndex=0;poseIndex<poses.length;poseIndex++){
  const pose=poses[poseIndex];actualBody(actor,pose.skinMatrices,bodyPositions);body.refit(bodyPositions);
  for(const side of ['L','R']){
   const fit=fits[side],m=pose.skinMatrices[fit.foot.footId],{records,seeds}=samples[side],q=new Float64Array(4);let minimumM=Infinity,worst=null,negativeCount=0,below1mmCount=0,soleMinimumWorldYM=Infinity;
   for(let i=0;i<records.length;i++){
    const r=records[i],p=transform(m,...r.restNative),face=body.nearest(...p,Infinity,seeds[i]);seeds[i]=face;body.evaluate(face,...p,q);
    negativeCount+=q[0]<0;below1mmCount+=q[0]<.001;
    if(q[0]<minimumM){minimumM=q[0];worst={...r,posedNative:p,bodyTriangle:face/3,bodyVertices:Array.from(actor.nativeSource.faces.subarray(face,face+3)),bodyNormal:Array.from(q.subarray(1))};}
   }
   for(const p of fit.record.solePointsNative){const a=transform(m,...p),R=pose.rootMatrix,y=R[1]*a[0]+R[5]*a[2]-R[9]*a[1]+R[13];soleMinimumWorldYM=Math.min(soleMinimumWorldYM,y);}
   const floorReport=pose.feet[side].soleMinimumWorldYM;
   rows.push({actor:id,side,poseIndex,frame:pose.frame,time:pose.time,phase:pose.phase,sourceFrame:pose.sourceFrame,attached:pose.attached,token:pose.token,samples:records.length,minimumM,negativeCount,below1mmCount,worst,
    soleVertices:fit.record.solePointsNative.length,soleMinimumWorldYM,recordedSoleWorldYM:floorReport,soleReportErrorM:Math.abs(soleMinimumWorldYM-floorReport),planted:pose.feet[side].planted,elapsedActorMS:performance.now()-started});
  }
  if(poseIndex%8===0||poseIndex===48){save();const recent=rows.filter(r=>r.actor===id);console.log(JSON.stringify({actor:id,poses:poseIndex+1,minimumM:Math.min(...recent.map(r=>r.minimumM)),negative:recent.reduce((n,r)=>n+r.negativeCount,0),below1mm:recent.reduce((n,r)=>n+r.below1mmCount,0),ms:performance.now()-started}));}
 }
 save();
}
