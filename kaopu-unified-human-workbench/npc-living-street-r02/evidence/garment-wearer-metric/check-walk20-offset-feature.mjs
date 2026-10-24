/** Only inspect two already recorded same-pose contact requests. No cloth
 * step or new body pose. Test the exact local offset of the two witnessed
 * neighboring real body faces, then verify against the complete body. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {NativeGarmentContact,nativeFaceNormal} from '../../src/NativeGarmentContact.mjs';
import {closestTriangle} from '../../vendor/appearance/cloth-r10/mesh-contact.mjs';
const folder=new URL('./',import.meta.url),load=n=>JSON.parse(fs.readFileSync(new URL(n,folder))),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const trace=load('D_WALK20_SOURCE_TOP_CONTACT_TRACE.json'),geometry=load('D-source-top-reference-initial-prefix-first-failure-corrective-geometry.json');
const P=Float64Array.from(geometry.body.positions),F=Int32Array.from(geometry.body.faces),contact=new NativeGarmentContact(P,F),margin=.00461;
const dot=(a,b)=>a.reduce((v,x,k)=>v+x*b[k],0),sub=(a,b)=>a.map((v,k)=>v-b[k]);
function solve(A,b){A=A.map((r,i)=>[...r,b[i]]);for(let i=0;i<b.length;i++){let best=i;for(let j=i+1;j<b.length;j++)if(Math.abs(A[j][i])>Math.abs(A[best][i]))best=j;[A[i],A[best]]=[A[best],A[i]];if(Math.abs(A[i][i])<1e-14)return null;const d=A[i][i];for(let k=i;k<=b.length;k++)A[i][k]/=d;for(let j=0;j<b.length;j++)if(j!==i){const v=A[j][i];for(let k=i;k<=b.length;k++)A[j][k]-=v*A[i][k];}}return A.map(r=>r.at(-1));}
function face(f,point){const q=new Float64Array(7);closestTriangle(P,F,f,...point,q);return{face:f,triangle:f/3,ids:Array.from(F.subarray(f,f+3)),normal:Array.from(nativeFaceNormal(P,F,f)),closest:Array.from(q.subarray(1,4)),bary:Array.from(q.subarray(4,7)),distance:Math.sqrt(q[0])};}
const rows=[];
for(const eventIndex of [35,71]){
 const e=trace.events[eventIndex],point=e.point,first=contact.inspect(...point),a=face(first.face,point),direction=sub(point,a.closest).map(v=>v/first.distance),radialDelta=direction.map(v=>v*(margin-first.distance)),radial=point.map((v,k)=>v+radialDelta[k]),radialProof=contact.inspect(...radial),b=face(radialProof.face,radial),N1=a.normal,N2=b.normal;
 const d1=margin-dot(N1,sub(point,a.closest)),d2=margin-dot(N2,sub(point,b.closest)),c=dot(N1,N2),det=1-c*c,l1=(d1-c*d2)/det,l2=(d2-c*d1)/det,delta=N1.map((v,k)=>l1*v+l2*N2[k]),endpoint=point.map((v,k)=>v+delta[k]),proof=contact.inspect(...endpoint);
 const row={eventIndex,phase:e.phase,sample:e.sample,point,origin:e.origin,sourcePreferredNormal:e.normal,
  oldRequest:{lengthM:Math.hypot(...e.result.delta),sourceFace:e.result.sourceFace,endpoint:e.result.endpoint},firstFace:a,radial:{delta:radialDelta,endpoint:radial,proof:radialProof},secondFace:b,
  twoFaceActiveProjection:{derivation:'minimum Euclidean delta satisfying the two observed actual face offset halfspaces; lambda=(N*N^T)^-1*(margin-signedPlaneDistances)',normalDot:c,normalAngleDegrees:Math.acos(Math.max(-1,Math.min(1,c)))*180/Math.PI,determinant:det,offsetDeficits:[d1,d2],multipliers:[l1,l2],positiveMultipliers:l1>=0&&l2>=0,delta,lengthM:Math.hypot(...delta),endpoint,preferredNormalDot:dot(delta,e.normal),distanceFromReferenceM:Math.hypot(...sub(endpoint,e.origin)),fullBodyProof:proof,faceProofs:[face(a.face,endpoint),face(b.face,endpoint)],qualified:!proof.inside&&proof.distance>=margin-1e-10&&Math.hypot(...sub(endpoint,e.origin))<=.08&&dot(delta,e.normal)>0}}
 if(proof.distance<margin-1e-10&&proof.face!==a.face&&proof.face!==b.face){
   const third=face(proof.face,endpoint),faces=[a,b,third],normals=faces.map(f=>f.normal),deficits=faces.map(f=>margin-dot(f.normal,sub(point,f.closest))),G=normals.map(n=>normals.map(m=>dot(n,m))),multipliers=solve(G,deficits);
   if(multipliers){const delta=[0,1,2].map(k=>multipliers.reduce((v,l,j)=>v+l*normals[j][k],0)),endpoint=point.map((v,k)=>v+delta[k]),fullBodyProof=contact.inspect(...endpoint);row.thirdWitnessProjection={thirdFace:third,derivation:'same three dimensional active feature solve, third face supplied solely by the failed two-face endpoint nearest witness',multipliers,positiveMultipliers:multipliers.every(v=>v>=0),delta,lengthM:Math.hypot(...delta),endpoint,fullBodyProof,preferredNormalDot:dot(delta,e.normal),faceProofs:faces.map(f=>face(f.face,endpoint)),qualified:!fullBodyProof.inside&&fullBodyProof.distance>=margin-1e-10&&Math.hypot(...sub(endpoint,e.origin))<=.08&&dot(delta,e.normal)>0};
    if(multipliers.some(v=>v<0)){
      const kept=multipliers.map((v,i)=>v>=0?i:-1).filter(i=>i>=0),G2=kept.map(i=>kept.map(j=>G[i][j])),L=solve(G2,kept.map(i=>deficits[i]));
      if(L){const delta=[0,1,2].map(k=>L.reduce((v,l,j)=>v+l*normals[kept[j]][k],0)),endpoint=point.map((v,k)=>v+delta[k]),proof=contact.inspect(...endpoint),planeResiduals=normals.map((n,i)=>dot(n,delta)-deficits[i]);row.activeSetRemoveNegative={keptFaceOffsets:kept.map(i=>faces[i].face),removedFaceOffsets:faces.map((f,i)=>kept.includes(i)?-1:f.face).filter(f=>f>=0),reason:'a negative multiplier cannot be an active outward contact; remove that linearized constraint and solve the remaining witnessed feature',multipliers:L,positiveMultipliers:L.every(v=>v>=0),planeResiduals,delta,lengthM:Math.hypot(...delta),endpoint,fullBodyProof:proof,preferredNormalDot:dot(delta,e.normal),faceProofs:faces.map(f=>face(f.face,endpoint)),qualified:!proof.inside&&proof.distance>=margin-1e-10&&Math.hypot(...sub(endpoint,e.origin))<=.08&&dot(delta,e.normal)>0};}
    }
   }
 }
 rows.push(row);
}
const output={schema:'same-walk20-outside-two-real-face-feature-readonly/1',releaseCandidate:false,newClothCandidateRun:false,bodyOrMotionChanged:false,parametersChanged:false,sourceHashes:trace.sourceHashes,traceSHA256:hash(fs.readFileSync(new URL('D_WALK20_SOURCE_TOP_CONTACT_TRACE.json',folder))),sourcePlanningMarginM:margin,finalAuditMarginM:.004,rows};
fs.writeFileSync(new URL('D_WALK20_OFFSET_FEATURE_READONLY.json',folder),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
