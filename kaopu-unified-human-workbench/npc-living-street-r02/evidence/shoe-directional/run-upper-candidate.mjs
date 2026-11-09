import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {THREE} from '../../src/NativeBinding.mjs';
import {actorFor} from '../shoe-recovery/native-actor.mjs';
import {fitNativeShoeSide} from '../../src/NativeShoes.mjs';
import {fitNativeShoeGeometry} from '../../src/NativeShoeFit.mjs';
import {MeshContact} from '../../vendor/appearance/cloth-adapted/mesh-contact.mjs';
import {buildSurface,inspectOrientation} from '../shoe-recovery/geometry-audit.mjs';
import {createActualAnkleUpperCandidate} from './ActualAnkleUpperCandidate.mjs';
const root=globalThis.__SHOE_QA_ROOT__,out=path.join(root,'evidence/shoe-directional/upper-single-pose');fs.mkdirSync(out,{recursive:true});
const file='evidence/CAPTURE_RECOVERY_CHAIN_SIX_FINAL_POSES.json',bytes=fs.readFileSync(path.join(root,file)),cache=JSON.parse(bytes),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),failures=JSON.parse(fs.readFileSync(path.join(root,'evidence/shoe-directional/PICKUP_FAILURE_DIRECTIONAL_VS_BASELINE.json'))),rows=[];
if(sha(bytes)!=='d86cb78585ccc95c8373eb234cda477ef31d9bc8a71ad674d6b03542332d5eaa')throw Error('Actual pose source changed');
const pos=(m,p)=>[0,1,2].map(k=>m[k*4]*p[0]+m[k*4+1]*p[1]+m[k*4+2]*p[2]+m[k*4+3]);
const rot=(m,p)=>[0,1,2].map(k=>m[k*4]*p[0]+m[k*4+1]*p[1]+m[k*4+2]*p[2]);
const native=(fit,p)=>{const r=fit.field.mirror*p[0]*fit.scaleM+fit.field.centerR,f=p[2]*fit.scaleM+fit.field.centerF;return[fit.foot.foot[0]+fit.foot.right[0]*r+fit.foot.forward[0]*f,fit.foot.foot[1]+fit.foot.right[1]*r+fit.foot.forward[1]*f,p[1]*fit.scaleM+fit.field.baseZ];};
function posedBody(actor,pose){const P=new Float64Array(actor.nativeSource.positions.length),r=actor.binding.displayRange,e=actor.binding.displayPacked;
 for(let i=0;i<actor.nativeSource.bodyCount;i++)for(let n=0;n<r[i*4+1];n++){const k=(r[i*4]+n)*8,p=pos(pose.skinMatrices[e[k+3]],[e[k],e[k+1],e[k+2]]);for(let q=0;q<3;q++)P[i*3+q]+=e[k+4]*p[q];}return P;
}
function audit(actor,pose,fit,bodyPositions){const body=new MeshContact(bodyPositions,actor.nativeSource.faces),q=new Float64Array(4),seen=new Set(),edges=new Set(),m=pose.skinMatrices[fit.foot.footId];let minimumM=Infinity,negative=0,below1mm=0,samples=0,worst=null;
 const sample=(p,meta)=>{const actual=pos(m,native(fit,p)),f=body.nearest(...actual);body.evaluate(f,...actual,q);samples++;negative+=q[0]<0;below1mm+=q[0]<.001;if(q[0]<minimumM){minimumM=q[0];worst={...meta,pointMm:p,posedNative:actual,bodyTriangle:f/3,bodyVertices:Array.from(actor.nativeSource.faces.subarray(f,f+3))};}};
 for(const kind of ['upper','insole'])for(const t of buildSurface(fit,kind).triangles){
  for(let k=0;k<3;k++){const key=t.part+'/'+t.ids[k];if(!seen.has(key)){seen.add(key);sample(t.points[k],{part:t.part,kind:'vertex',vertex:t.ids[k]});}}
  sample([0,1,2].map(k=>(t.points[0][k]+t.points[1][k]+t.points[2][k])/3),{part:t.part,kind:'center',triangle:t.triangle});
  for(let k=0;k<3;k++){const j=(k+1)%3,a=t.ids[k],b=t.ids[j],key=t.part+'/'+Math.min(a,b)+'/'+Math.max(a,b);if(!edges.has(key)){edges.add(key);sample(t.points[k].map((v,c)=>(v+t.points[j][c])*.5),{part:t.part,kind:'edge',edge:[a,b]});}}
 }return{samples,minimumM,negative,below1mm,worst,orientation:inspectOrientation(fit)};
}
function exportView(id,mode,actor,pose,fits,body,focus,frame){const garments=[];
 for(const side of ['L','R']){const fit=fits[side],m=pose.skinMatrices[fit.foot.footId],mirror=side==='L'?-1:1;
  for(const part of fit.model.parts){const P=part.geometry.attributes.position,N=part.geometry.attributes.normal,positions=[],normals=[];
   for(let i=0;i<P.count;i++){
    positions.push(...pos(m,native(fit,[P.getX(i),P.getY(i),P.getZ(i)])));
    const n=new THREE.Vector3(N.getX(i)*mirror,N.getY(i),N.getZ(i)).transformDirection(fit.restNative);normals.push(...rot(m,[n.x,n.y,n.z]));
   }
   const pigment=/sole|rubber|welt|foxing/.test(part.id+' '+part.role)?[.79,.80,.75]:/eyelet|metal/.test(part.id+' '+part.role)?[.48,.50,.47]:/lace|thread|stitch/.test(part.id+' '+part.role)?[.81,.82,.73]:/insole/.test(part.id)?[.67,.65,.56]:[.32,.43,.36];
   garments.push({id:side+'/'+part.id,positions,normals,faces:Array.from(part.geometry.index.array),reflection:side==='L',pigment});
  }
 }
 const f=fits[focus],m=pose.skinMatrices[f.foot.footId],d=(r,forward,z)=>rot(m,[f.foot.right[0]*r+f.foot.forward[0]*forward,f.foot.right[1]*r+f.foot.forward[1]*forward,z]);
 const data={schema:'actual-single-pose-native-upper-diagnostic/1',actor:id+' '+mode,pose:pose.phase+' frame '+pose.frame,nativeAxis:'Z-up',sourceHashes:globalThis.__SHOE_QA_SOURCE_HASHES__,
  body:{positions:Array.from(body),faces:Array.from(actor.nativeSource.faces)},garments,frame,
  cameras:[['OUTER SIDE',d(1,0,.12)],['HEEL',d(.1,-1,.25)],['TOE / INSTEP',d(.65,1,.45)],['OPENING ABOVE',d(.2,-.9,1)]],
  limitations:['Single exact cached pose, complete body and both original shoes. Only the chosen anatomical foot has the candidate upper map.','Native CPU geometry and flat diagnostic pigments; no source shader or website acceptance.','Candidate and baseline share identical camera bounds.']};
 const filename=path.join(out,id+'_'+mode+'.json.gz');fs.writeFileSync(filename,zlib.gzipSync(JSON.stringify(data)));return path.relative(root,filename);
}
for(const id of ['A','D']){const worst=failures.rows.find(r=>r.actor===id),pose=cache.samples.find(p=>p.actor===id&&p.frame===worst.frame&&p.token),actor=actorFor(id),fits=Object.fromEntries(['L','R'].map(s=>[s,fitNativeShoeSide(actor,s)])),fit=fits[worst.side],body=posedBody(actor,pose),inverse=new THREE.Matrix4().fromArray(pose.skinMatrices[fit.foot.footId]).transpose().invert(),footBody=new Float64Array(body.length);
 for(let i=0;i<body.length;i+=3){const p=new THREE.Vector3(body[i],body[i+1],body[i+2]).applyMatrix4(inverse);footBody.set([p.x,p.y,p.z],i);}
 const candidate=createActualAnkleUpperCandidate(actor,fit,footBody),row={actor:id,side:worst.side,frame:pose.frame,phase:pose.phase,sourceFrame:pose.sourceFrame,constructed:candidate.constructed,driver:candidate.report};
 if(candidate.constructed){const model=fitNativeShoeGeometry(fit.sourceModel,candidate.field),newFit={...fit,field:candidate.field,model},candidateFits={...fits,[worst.side]:newFit};
  row.audit=audit(actor,pose,newFit,body);row.fitting=model.report.wearerFit;let maxMoveM=0,changedSoleComponents=0,changedY=0,soleVertices=0;const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],m=pose.skinMatrices[fit.foot.footId];
  for(let j=0;j<model.parts.length;j++){const current=model.parts[j],P=current.geometry.attributes.position,B=fit.model.parts[j].geometry.attributes.position,isSole=/sole|heel|rubber|welt/.test(current.id+' '+current.role);
   for(let i=0;i<P.count;i++){const p=[P.getX(i),P.getY(i),P.getZ(i)],b=[B.getX(i),B.getY(i),B.getZ(i)];maxMoveM=Math.max(maxMoveM,Math.hypot(...p.map((v,k)=>v-b[k]))*fit.scaleM);changedY+=p[1]!==b[1];if(isSole){soleVertices++;for(let k=0;k<3;k++)changedSoleComponents+=p[k]!==b[k];}
    for(const point of [pos(m,native(fit,p)),pos(m,native(fit,b))])for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],point[k]);hi[k]=Math.max(hi[k],point[k]);}
   }
  }
  row.maximumActualVertexDisplacementM=maxMoveM;row.changedSoleComponents=changedSoleComponents;row.soleVertices=soleVertices;row.changedYComponents=changedY;
  const frame={min:lo,max:hi.map((v,k)=>v+(k===2?.04:0)),focus:'same actual sole and ankle; camera bounds union of baseline/candidate'};
  row.imagesInputs=[exportView(id,'BASELINE',actor,pose,fits,body,worst.side,frame),exportView(id,'CANDIDATE',actor,pose,candidateFits,body,worst.side,frame)];
  row.passed=row.audit.below1mm===0&&row.audit.orientation.transportedNormalDisagreements===0&&changedSoleComponents===0;
 }else row.passed=false;
 rows.push(row);fs.writeFileSync(path.join(out,'ACTUAL_UPPER_SINGLE_POSE_RECEIPT.json'),JSON.stringify({schema:'actual-native-ankle-upper-single-pose-experiment/1',sourceHashes:globalThis.__SHOE_QA_SOURCE_HASHES__,poseCache:{path:file,sha256:sha(bytes)},rows,productionIntegrated:false,visualAcceptance:false},null,2)+'\n');
 console.log(JSON.stringify({actor:id,constructed:row.constructed,passed:row.passed,min:row.audit?.minimumM,negative:row.audit?.negative,below1mm:row.audit?.below1mm,orientation:row.audit?.orientation?.transportedNormalDisagreements,changeM:row.maximumActualVertexDisplacementM,failures:row.driver.failures?.slice(0,3)}));
}
