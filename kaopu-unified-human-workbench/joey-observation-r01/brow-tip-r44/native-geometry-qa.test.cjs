'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {auditNativeGeometry,_testing:T}=require('./native-geometry-qa.cjs');
const close=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
const closePoint=(a,b,eps)=>a.forEach((x,i)=>close(x,b[i],eps));
const sortedLine=line=>line.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);
const A=[[-1,-1,0],[1,-1,0],[0,1,0]];
const B=[[0,-0.5,-1],[0,-0.5,1],[0,0.5,0]];

test('analytic crossing returns the known segment on both surfaces',()=>{
  const hit=T.triangleIntersection(A,B);
  assert.equal(hit.kind,'proper_crossing');close(hit.lengthM,1);
  closePoint(sortedLine(hit.line)[0],[0,-0.5,0]);closePoint(sortedLine(hit.line)[1],[0,0.5,0]);
});
test('crossing is symmetric and invariant under winding reversal',()=>{
  const original=T.triangleIntersection(A,B);
  for(const [a,b] of [[B,A],[A.slice().reverse(),B],[A,B.slice().reverse()]]) {
    const hit=T.triangleIntersection(a,b);assert.equal(hit.kind,original.kind);close(hit.lengthM,original.lengthM);
    const p=sortedLine(hit.line),q=sortedLine(original.line);p.forEach((v,i)=>closePoint(v,q[i]));
  }
});
test('overlapping AABBs do not fabricate a triangle intersection',()=>{
  const a=[[0,0,0],[2,0,0],[0,2,0]],b=[[1.5,1.5,-1],[1.5,1.5,1],[2,2,0]];
  assert.equal(T.triangleIntersection(a,b),null);
});
test('parallel separated triangles are disjoint',()=>{
  assert.equal(T.triangleIntersection(A,A.map(p=>[p[0],p[1],1e-6])),null);
});
test('coplanar positive-area overlap retains a polygon and line witness',()=>{
  const hit=T.triangleIntersection(A,A);
  assert.equal(hit.kind,'coplanar_overlap');close(hit.overlapAreaM2,2);assert.equal(hit.polygon.length,3);
  close(hit.lengthM,Math.sqrt(5));
});
test('coplanar disjoint triangles do not become contacts',()=>{
  assert.equal(T.triangleIntersection(A,A.map(p=>[p[0]+5,p[1],p[2]])),null);
});
test('shared coplanar edge is a tangent segment, not a crossing',()=>{
  const a=[[0,0,0],[1,0,0],[0,1,0]],b=[[0,0,0],[1,0,0],[0,-1,0]];
  const hit=T.triangleIntersection(a,b);assert.equal(hit.kind,'tangent_segment');close(hit.lengthM,1);close(hit.overlapAreaM2,0);
});
test('single-vertex touch is explicitly a point contact',()=>{
  const a=[[0,0,0],[1,0,0],[0,1,0]],b=[[0,0,0],[-1,0,1],[0,-1,1]];
  const hit=T.triangleIntersection(a,b);assert.equal(hit.kind,'point_contact');close(hit.lengthM,0);
});
test('zero-area triangle is unresolved degenerate, not clearance',()=>{
  assert.equal(T.triangleIntersection([[0,0,0],[0,0,0],[1,0,0]],A).kind,'degenerate');
});
test('intersection preserves metre scale and translation',()=>{
  const translate=[0.035,-0.11,0.72],scale=0.003;
  const move=p=>p.map((x,i)=>x*scale+translate[i]);
  const hit=T.triangleIntersection(A.map(move),B.map(move));assert.equal(hit.kind,'proper_crossing');close(hit.lengthM,scale,1e-13);
});
test('near-parallel crossing is still analytically found above angular tolerance',()=>{
  const b=[[-1,-1,-1e-7],[1,-1,-1e-7],[0,1,1e-7]];
  const hit=T.triangleIntersection(A,b);assert.equal(hit.kind,'proper_crossing');close(hit.lengthM,1,1e-9);
});
test('ray BVH includes all faces and finds an earlier occluder',()=>{
  const pos=[...A.flat(),...A.map(p=>[p[0],p[1],1]).flat()];
  const tris=T.makeTriangles(pos,[0,1,2,3,4,5],['skin','other']);
  const hit=T.firstRayHit(T.makeBVH(tris),[0,0,3],[0,0,-1],5,false,1e-10);
  assert.equal(hit.face,1);assert.equal(hit.kind,'other');close(hit.distanceM,2);
});
test('two-sided and renderer FrontSide ray modes differ on a back face',()=>{
  const tri=T.makeTriangles(A.flat(),[0,2,1],['skin'])[0];
  close(T.rayTriangle([0,0,3],[0,0,-1],tri,false),3);
  assert.equal(T.rayTriangle([0,0,3],[0,0,-1],tri,true),null);
});
test('near-plane clipping prevents a pre-near-plane triangle becoming an occluder',()=>{
  const pos=[...A.flat(),...A.map(p=>[p[0],p[1],2.995]).flat()];
  const hit=T.firstRayHit(T.makeBVH(T.makeTriangles(pos,[0,1,2,3,4,5],['skin','skin'])),[0,0,3],[0,0,-1],5,false,1e-10,0.01);
  assert.equal(hit.face,0);close(hit.distanceM,3);
});
test('saved camera projects native common coordinates into 797 x 590 pixels',()=>{
  const c=T.prepareCamera('front',{position:[0,0,3],target:[0,0,0],fov:90,zoom:1,width:797,height:590,aspect:797/590});
  const middle=T.projectPoint([0,0,0],c);close(middle.x,398.5);close(middle.y,295);
  const right=T.projectPoint([3,0,0],c);close(right.x,693.5);
  const above=T.projectPoint([0,0,3],c);close(above.y,0);
  assert.equal(T.projectPoint([0,-4,0],c).behind,true);
});
test('captured column-major camera matrices match the analytic projection',()=>{
  const base={position:[0,0,3],target:[0,0,0],fov:90,zoom:1,width:797,height:590,aspect:797/590,near:0.01,far:50};
  const n=base.near,f=base.far,p=[1/base.aspect,0,0,0,0,1,0,0,0,0,-(f+n)/(f-n),-1,0,0,-2*f*n/(f-n),0];
  const v=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,-3,1];
  const ca=T.prepareCamera('basis',base),cm=T.prepareCamera('matrix',{...base,projectionMatrix:p,matrixWorldInverse:v});
  for(const point of [[0,0,0],[0.3,0.2,0.8],[-0.1,-0.2,-0.3]]) {
    const a=T.projectPoint(point,ca),b=T.projectPoint(point,cm);close(a.x,b.x);close(a.y,b.y);assert.equal(a.inFrame,b.inFrame);
  }
});

function fixture() {
  // Complete tiny source: skin and two open triangular eye surfaces, plus body.
  const positions=[
    -1,4,-1, 1,4,-1, 0,4,1,
    -1,0,-1, 1,0,-1, 0,0,1,
    0,-1,-0.5, 0,1,-0.5, 0,0,0.5,
    4,-1,-0.5, 4,1,-0.5, 4,0,0.5,
  ],faces=[0,1,2,3,4,5,6,7,8,9,10,11];
  return {baseline:{positions:positions.slice(),faces:faces.slice()},candidate:{positions:positions.slice(),faces:faces.slice()},mapping:{bodyCount:3,gnmRecipes:Array.from({length:9},(_,i)=>[i,i,0]),componentId:[0,0,0,1,1,1,2,2,2],gnmTriangles:[0,1,2,3,4,5,6,7,8]},cameras:{front:{position:[0,0,5],target:[0,0,0],fov:50,zoom:1,width:797,height:590,near:0.01,far:50}},options:{maxWitnesses:10}};
}
test('complete identical synthetic mesh passes structural gates and reports open eyes',()=>{
  const report=auditNativeGeometry(fixture());
  assert.equal(report.structuralPass,true);assert.equal(report.appearanceAccepted,false);
  assert.equal(report.candidateContacts.kinds.proper_crossing,1);
  assert.equal(report.mapping.fullNativeEyeTopologyVerified,true);
  assert.equal(report.eyeTopology.eye1.boundaryEdges,3);
  assert.equal(report.eyeTopology.eye1.solidPenetrationDepthClaimed,false);
  assert.equal(report.contactChange.addedPairCount,0);
  assert.ok(report.candidateContacts.witnesses[0].views.front.counts.inFrame>0);
});
test('a newly introduced visible skin-eye crossing is compared against clear baseline',()=>{
  const f=fixture();for(const i of [6,7,8])f.baseline.positions[i*3]+=3;
  const report=auditNativeGeometry(f);
  assert.equal(report.baselineContacts.totalContactPairs,0);assert.equal(report.candidateContacts.kinds.proper_crossing,1);
  assert.equal(report.contactChange.addedPairCount,1);assert.equal(report.gates.eyesWithinFrozenTolerance,false);
  assert.ok(report.candidateContacts.views.front.potentiallyVisibleFrontSidePairs>0);
});
test('body and full-eye displacement guards cannot be hidden by unchanged skin',()=>{
  const f=fixture();f.candidate.positions[0]+=0.001;f.candidate.positions[18]+=0.002;
  const r=auditNativeGeometry(f);assert.equal(r.gates.bodyWithinFrozenTolerance,false);assert.equal(r.gates.eyesWithinFrozenTolerance,false);assert.equal(r.structuralPass,false);
  close(r.health.displacement.body.maxM,0.001);close(r.health.displacement.eye1.maxM,0.002);close(r.health.displacement.skin.maxM,0);
});
test('nonfinite coordinates fail before producing false collision clearance',()=>{
  const f=fixture();f.candidate.positions[4]=NaN;
  const r=auditNativeGeometry(f);assert.equal(r.status,'failed_input_validation');assert.equal(r.input.candidateNonfiniteCount,1);assert.equal(r.candidateContacts,undefined);
});
test('out-of-range topology and topology reorder are rejected',()=>{
  let f=fixture();f.candidate.faces[0]=999;let r=auditNativeGeometry(f);assert.equal(r.input.invalidIndexCount,1);assert.equal(r.structuralPass,false);
  f=fixture();[f.candidate.faces[0],f.candidate.faces[1]]=[f.candidate.faces[1],f.candidate.faces[0]];r=auditNativeGeometry(f);assert.equal(r.input.exactFaceIndices,false);
});
test('new degeneration and face-normal reversal are separately detected',()=>{
  let f=fixture();f.candidate.positions.splice(15,3,...f.candidate.positions.slice(9,12));let r=auditNativeGeometry(f);assert.equal(r.health.newDegenerateCount,1);assert.equal(r.gates.noNewDegenerateFaces,false);
  f=fixture();f.candidate.positions[17]=-2;r=auditNativeGeometry(f);assert.equal(r.health.reversedNormalCount,1);assert.equal(r.gates.noReversedNormals,false);
});
test('native mapping uses interpolation endpoints without guessing across components',()=>{
  const f=fixture();f.mapping.gnmRecipes[0]=[0,3,0];assert.equal(auditNativeGeometry(f).mapping.commonComponentCounts[0],3);
  f.mapping.gnmRecipes[0]=[0,3,0.5];assert.throws(()=>auditNativeGeometry(f),/Mixed-component native recipe/);
});
test('full-eye coverage requires all source eye vertices and faces',()=>{
  const f=fixture();f.mapping.gnmTriangles.push(3,4,3);
  const r=auditNativeGeometry(f);assert.equal(r.gates.fullNativeEyes,false);assert.equal(r.mapping.missingSourceEyeFaceCount,1);
});
test('pair cap preserves complete counts and flags omitted evidence',()=>{
  const f=fixture();f.options.maxWitnesses=1;
  // Put the second full eye at the same crossing using the actual second mesh.
  for(let i=9;i<12;i++) {f.baseline.positions[i*3]-=4;f.candidate.positions[i*3]-=4;}
  const r=auditNativeGeometry(f);assert.equal(r.candidateContacts.totalContactPairs,2);assert.equal(r.candidateContacts.witnesses.length,1);assert.equal(r.candidateContacts.witnessesOmitted,1);
});
test('report never exports the complete native arrays or component recipes',()=>{
  const r=auditNativeGeometry(fixture());
  const visit=o=>{if(o&&typeof o==='object')for(const [k,v]of Object.entries(o)){assert.ok(!['positions','faces','gnmRecipes','gnmTriangles','componentId'].includes(k),'raw field '+k);visit(v);}};
  visit(r);assert.doesNotThrow(()=>JSON.stringify(r));
});

