import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deriveMeasuredCase,queryCase,patchDistance,intersectCaseRay,buildCaseGLSL} from '../r06/cases.mjs';
import {deriveEvidenceAssembly,queryAssembly,assemblyNormal,assemblyLocalToSource,sourceToAssemblyLocal,intersectAssemblyRay,buildAssemblyGLSL} from '../r06/assemblies.mjs';
import {CONTEXT_SCHEMA,deriveCaseContext,queryContext,contextNormal,contextMaterialDirection,intersectContextRay,buildContextGLSL} from '../r06/context.mjs';

const models={lowrise:'B367642137201063C0',kcc:'B359971994401063C0',warehouse:'B369121858401063C0'},measured={},assemblies={},contexts={};
for(const [id,model] of Object.entries(models)){
 measured[id]=deriveMeasuredCase(JSON.parse(readFileSync(new URL(`../../hk-three-buildings-r01/geometry/${model}.score.json`,import.meta.url))));
 assemblies[id]=deriveEvidenceAssembly(id,measured[id],{alignmentTransform:{translation:[1.7,5.2,-1.3],yawRadians:.731}});
 contexts[id]=deriveCaseContext(measured[id],assemblies[id],{inspectionContext:true});
}
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,t)=>a.map(v=>v*t),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),length=a=>Math.hypot(...a),unit=a=>mul(a,1/length(a));
const close=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`),vecClose=(a,b,e=1e-7)=>a.forEach((v,i)=>close(v,b[i],e));
const rotate=(s,p,inverse=false)=>{const c=Math.cos(s.alignmentTransform.yawRadians),n=Math.sin(s.alignmentTransform.yawRadians)*(inverse?-1:1);return [c*p[0]+n*p[2],p[1],-n*p[0]+c*p[2]];};
let seed=84018;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const random=b=>b.min.map((v,i)=>v-3+rnd()*(b.max[i]-v+6));
function synthetic(operations){return deriveMeasuredCase({adapter:'kaopu.hk.measured-plane-boundary/0.1-research',units:'metre',objectId:models.lowrise,edits:{},georeference:{originEastingNorthingHeight:[0,0,0]},evidence:{},reconstruction:{generator:'hk-measured-boundary',version:'0.1.0',operations}});}
const wall=(id,z,bottom=0,top=5)=>({id,kind:'wallStrip',edge:[[-10,-z],[10,-z]],bottom,top});
function isolatedSourceContext(operations,sourceDisplay){const m=synthetic(operations),a=deriveEvidenceAssembly('lowrise',m,{alignmentTransform:{translation:[100,1,0],yawRadians:0}});return deriveCaseContext(m,a,{inspectionContext:true,...(sourceDisplay?{sourceDisplay}:{})});}
function separateReference(s,origin,direction,{display=false,maxDistance=1000}={}){
 const rd=unit(direction),a=intersectAssemblyRay(s.assembly,sourceToAssemblyLocal(s.assembly,origin),rotate(s,rd,true),{maxDistance});let source=null;
 // Independent exhaustive finite-polygon candidates, not a copy of interval code.
 for(const p of s.measured.patches){const den=dot(rd,p.n);if(Math.abs(den)<1e-12)continue;const t=dot(sub(p.origin,origin),p.n)/den;if(t<0||t>maxDistance||(source&&t>=source.t))continue;const q=add(origin,mul(rd,t));if(patchDistance(p,q)>1e-8)continue;
  if(display&&(q[1]<s.sourceDisplay.heightRange[0]||q[1]>s.sourceDisplay.heightRange[1]||dot(s.sourceDisplay.cutPlane.normal,q)<s.sourceDisplay.cutPlane.offset))continue;
  if(queryAssembly(s.assembly,sourceToAssemblyLocal(s.assembly,q)).distance<0)continue;
  source={t,point:q};
 }
 return source&&(!a.hit||source.t<=a.t)?source:a.hit?{t:a.t,point:add(origin,mul(rd,a.t))}:null;
}

test('context retains both authoritative fields and original source without declaring registration or occupancy',()=>{
 for(const [id,s] of Object.entries(contexts)){const m=measured[id],a=assemblies[id],before=JSON.stringify([m,a]),again=deriveCaseContext(m,a,{inspectionContext:true});assert.equal(JSON.stringify([m,a]),before);assert.equal(s.schema,CONTEXT_SCHEMA);assert.equal(s.sourceModelId,m.sourceModelId);assert.equal(s.fieldKind,'case-context');assert.deepEqual(again.measured,m);assert.deepEqual(again.assembly,a);assert.equal(s.registrationStatus,'unverified_editable_design');assert.equal(s.actualInteriorComplete,false);assert.equal(s.sourceGeometryChanged,false);assert.equal(s.sourceTransformApplied,false);assert.equal(s.structuralCertification,false);assert.equal(s.distanceContract.certifiedSDF,false);assert.equal(s.counts.modelTriangles,0);assert.equal(s.counts.modelVertexBuffers,0);assert.equal(s.sourceDisplay.scope,'DISPLAY_ONLY_SOURCE_SHELL');assert.equal(s.sourceDisplay.capsGenerated,false);assert.equal(s.sourceDisplay.groundClosureGenerated,false);assert.ok(s.sourceDisplay.label.includes('仅显示剖切'));assert.deepEqual(s.measured.sourceBounds,m.sourceBounds);}
});
test('full query is the min of the two independent fields with exact winner identity, role and material frame',()=>{
 let sources=0,designs=0;
 for(const s of Object.values(contexts))for(let i=0;i<240;i++){
  const p=i%2?random(s.fullBounds):assemblyLocalToSource(s.assembly,random(s.assembly.bounds)),a=queryCase(s.measured,p),b=queryAssembly(s.assembly,sourceToAssemblyLocal(s.assembly,p)),h=queryContext(s,p),expected=a.distance<=b.distance?a:b;
  close(h.distance,Math.min(a.distance,b.distance),1e-12);assert.equal(h.objectId,expected.objectId);assert.equal(h.materialRole,expected.materialRole);vecClose(h.local,expected.local,1e-12);assert.equal(h.sourceOccupancy,null);assert.equal(h.designInside,b.inside);assert.equal(h.queryScope,'authoritative_full_data');
  if(h.component==='source'){sources++;assert.ok(h.objectId>=1000&&h.objectId<2000);assert.equal(h.inside,null);assert.equal(h.coordinateFrame,'source-local');}else{designs++;assert.ok(h.objectId>=2000);assert.equal(h.coordinateFrame,'diagram-local');}
 }
 assert.ok(sources>50&&designs>50);
});
test('rigid placement preserves authored metres, signed occupancy and diagram-local material coordinates under yaw',()=>{
 for(const s of Object.values(contexts)){
  const local=[3,-.11,2],p=assemblyLocalToSource(s.assembly,local),h=queryContext(s,p),expected=queryAssembly(s.assembly,local);assert.equal(h.component,'assembly');assert.ok(h.distance<0);assert.equal(h.inside,true);close(h.distance,expected.distance);vecClose(h.local,local);assert.notDeepEqual(h.local,p);vecClose(contextNormal(s,p),rotate(s,assemblyNormal(s.assembly,local)));
  for(let i=0;i<35;i++){const p=random(s.fullBounds),h=queryContext(s,p),n=contextNormal(s,p);close(length(n),1);assert.ok(n.every(Number.isFinite));vecClose(n,h.component==='source'?queryCase(s.measured,p).normal:rotate(s,assemblyNormal(s.assembly,h.local)));}
 }
});
test('source normals and coordinates are not accidentally rotated with the design',()=>{
 const s=contexts.kcc,p=[40,40,20],h=queryContext(s,p);assert.equal(h.component,'source');vecClose(h.local,p,0);vecClose(contextNormal(s,p),queryCase(s.measured,p).normal,0);
});
test('full analytic composition agrees with independent finite source and rigid assembly rays',()=>{
 let hits=0;
 for(const s of Object.values(contexts))for(let i=0;i<130;i++){
  const ro=random(s.fullBounds),aim=i%2?s.bounds.min.map((v,a)=>(v+s.bounds.max[a])/2):assemblyLocalToSource(s.assembly,random(s.assembly.bounds)),rd=sub(aim,ro),expected=separateReference(s,ro,rd),actual=intersectContextRay(s,ro,rd,{display:false,maxDistance:1000});
  assert.equal(actual.hit,!!expected);assert.notEqual(actual.status,'unresolved');if(actual.hit){hits++;close(actual.t,expected.t,2e-7);const h=queryContext(s,actual.point);close(h.distance,0,2e-7);assert.equal(actual.objectId,h.objectId);assert.equal(actual.materialRole,h.materialRole);vecClose(actual.local,h.local);close(length(actual.normal),1);}
 }
 assert.ok(hits>200);
});
test('display rays agree with exhaustive per-face restriction, including rotated front cut and height band',()=>{
 let hits=0;
 for(const s of Object.values(contexts))for(let i=0;i<130;i++){
  const ro=random(s.bounds),rd=sub(random(s.bounds),ro),expected=separateReference(s,ro,rd,{display:true}),actual=intersectContextRay(s,ro,rd,{maxDistance:1000});assert.equal(actual.hit,!!expected);if(actual.hit){hits++;close(actual.t,expected.t,2e-7);const h=queryContext(s,actual.point,{display:true});assert.equal(h.objectId,actual.objectId);assert.equal(h.materialRole,actual.materialRole);vecClose(h.local,actual.local);if(actual.component==='source'){assert.ok(actual.point[1]>=s.sourceDisplay.heightRange[0]-1e-8&&actual.point[1]<=s.sourceDisplay.heightRange[1]+1e-8);assert.ok(dot(s.sourceDisplay.cutPlane.normal,actual.point)>=s.sourceDisplay.cutPlane.offset-1e-8);}}
 }
 assert.ok(hits>70);
});
test('display clip restricts rather than deletes source: removed front face cannot hide retained back face',()=>{
 const s=isolatedSourceContext([wall('front',-2),wall('back',2)]),before=JSON.stringify(s.measured),ray=[0,2,-10],direction=[0,0,1],full=intersectContextRay(s,ray,direction,{display:false}),display=intersectContextRay(s,ray,direction);
 assert.equal(full.objectId,1000);close(full.t,8);assert.equal(display.objectId,1001);close(display.t,12);close(display.sourceInterval[0],10);assert.equal(intersectCaseRay(s.measured,ray,direction).objectId,1000);assert.equal(JSON.stringify(s.measured),before);close(queryContext(s,[0,2,-2]).distance,0);assert.ok(queryContext(s,[0,2,-2],{display:true}).distance>0);assert.equal(s.measured.patches.length,2);
});
test('height-band entry restarts source query so a later valid horizontal face is retained',()=>{
 const plane=(id,y)=>({id,kind:'roofPlane',heightPlane:[0,0,y],loops:[[[-10,-10],[10,-10],[10,10],[-10,10]]]}),s=isolatedSourceContext([plane('low',0),plane('high',4)],{heightRange:[.5,4.5],cutPlane:{normal:[0,0,1],offset:0}}),h=intersectContextRay(s,[0,-10,1],[0,1,0]);assert.equal(h.hit,true);assert.equal(h.objectId,1001);close(h.t,14);assert.equal(intersectContextRay(s,[0,-10,1],[0,1,0],{display:false}).objectId,1000);
});
test('inspection cut contributes neither a fake front cap, vertical cap nor ground closure',()=>{
 const s=isolatedSourceContext([wall('front',-2),wall('back',2)]);
 const h=intersectContextRay(s,[0,2,-1],[0,0,1]);assert.equal(h.hit,true);close(h.point[2],2);assert.ok(h.t>1);
 for(const [ro,rd] of [[[0,10,1],[0,-1,0]],[[0,-10,1],[0,1,0]],[[0,2,1],[1,0,0]]])assert.equal(intersectContextRay(s,ro,rd,{maxDistance:20}).hit,false);
});
test('source surfaces buried inside signed authored solids are not visible when the ray begins inside a slab',()=>{
 const m=synthetic([wall('buried',0,-.2,.1),wall('outside',10,-.2,.1)]),a=deriveEvidenceAssembly('lowrise',m),s=deriveCaseContext(m,a,{inspectionContext:true,sourceDisplay:{heightRange:[-.2,.1],cutPlane:{normal:[0,0,1],offset:0}}}),h=intersectContextRay(s,[0,-.1,-1],[0,0,1],{display:false});
 assert.equal(intersectCaseRay(m,[0,-.1,-1],[0,0,1]).objectId,1000);assert.equal(h.component,'assembly');close(h.point[2],5.5);close(h.t,6.5);close(queryContext(s,h.point).distance,0);
});
test('assembly remains full and uncut even on the removed front and outside the source inspection band',()=>{
 const s=contexts.lowrise,local=[3,-.1,2],h=queryContext(s,assemblyLocalToSource(s.assembly,local),{display:true});assert.equal(h.component,'assembly');assert.ok(h.distance<0);const gate=s.assembly.primitives.find(p=>p.nodeId.endsWith('shared-site-gate')),q=[3,1,gate.range[0]-.5],ro=assemblyLocalToSource(s.assembly,q),rd=rotate(s,[0,0,1]),actual=intersectContextRay(s,ro,rd),expected=intersectAssemblyRay(s.assembly,q,[0,0,1]);assert.equal(actual.component,'assembly');close(actual.t,expected.t);vecClose(actual.local,expected.local);vecClose(actual.normal,rotate(s,expected.normal));
});
test('invalid matching, implicit placement, deformation, display domains and ray options reject',()=>{
 const m=measured.lowrise,a=assemblies.lowrise;assert.throws(()=>deriveCaseContext(m,assemblies.kcc),/Matching/);assert.throws(()=>deriveCaseContext(m,a),/inspectionContext/);assert.throws(()=>deriveCaseContext(m,a,{inspectionContext:false}));assert.throws(()=>deriveCaseContext(m,a,{inspectionContext:true,scale:2}),/Unknown/);
 for(const transform of [{translation:[0,0,0],yawRadians:0,scale:2},{translation:[0,0,NaN],yawRadians:0},{translation:[0,0,0],yawRadians:Infinity},{translation:[10001,0,0],yawRadians:0}]){const bad=structuredClone(a);bad.alignmentTransform=transform;assert.throws(()=>deriveCaseContext(m,bad,{inspectionContext:true}),/Rigid/);}
 for(const sourceDisplay of [{heightRange:[3,2]},{heightRange:[1000,1001]},{heightRange:[0,NaN]},{cutPlane:{normal:[1,1,0],offset:0}},{cutPlane:{normal:[0,0,2],offset:0}},{cutPlane:{normal:[0,0,1],offset:1000}},{caps:true}])assert.throws(()=>deriveCaseContext(m,a,{inspectionContext:true,sourceDisplay}));
 for(const direction of [[0,0,0],[0,NaN,1]])assert.throws(()=>intersectContextRay(contexts.lowrise,[0,0,0],direction));assert.throws(()=>intersectContextRay(contexts.lowrise,[0,0,0],[0,0,1],{maxDistance:0}));assert.throws(()=>queryContext(contexts.lowrise,[0,NaN,0]));assert.throws(()=>queryContext(contexts.lowrise,[0,0,0],{display:1}));
});
test('GLSL retains namespaced source and design bodies, exactly one FieldHit, data/display separation and no model geometry',()=>{
 const struct='struct FieldHit{float distance;float objectId;float materialRole;vec3 local;};';
 for(const s of Object.values(contexts)){
  const shader=buildContextGLSL(s);assert.equal(shader,buildContextGLSL(s));assert.equal(shader.split(struct).length,2);
  const namespace=(code,prefix)=>code.replace(struct,'').replace(/\b(?:case[A-Za-z0-9_]+|assembly[A-Za-z0-9_]+|mapField|mapDistance|fieldNormal|fieldRayNormal)\b/g,name=>prefix+name);
  assert.ok(shader.includes(namespace(buildCaseGLSL(s.measured),'contextSource_')));assert.ok(shader.includes(namespace(buildAssemblyGLSL(s.assembly),'contextDesign_')));
  for(const name of ['mapField','mapDistance','fieldNormal','displayMapField','displayMapDistance','contextSourceInterval','contextTraceRayFull','caseTraceRay','fieldRayNormal'])assert.ok(shader.includes(name));
  assert.ok(shader.includes('contextSource_caseTraceRay(ro+rd*lo,rd,sourceT'));assert.ok(shader.includes('sourceT>hi'));assert.ok(shader.includes('h=sourceWins?sourceHit:designHit'));assert.ok(!shader.includes('h=display?displayMapField(p):mapField(p)'));assert.ok(shader.includes('contextInverseRotate(rd)'));assert.ok(!/sampleFieldMaterial|directBRDF|sampler3D|texture\(|BufferGeometry|triangulate|createBuffer|drawElements|new\s+THREE/.test(shader));assert.equal((shader.match(/bool caseTraceRay\(/g)??[]).length,1);
 }
 const source=readFileSync(new URL('../r06/context.mjs',import.meta.url),'utf8');assert.ok(!/import.*three|BufferGeometry|triangulateShape|createBuffer|drawElements|MarchingCubes/.test(source));
});
test('negative yaw and offsets generate valid parenthesized GLSL arithmetic rather than accidental decrement tokens',()=>{
 const m=measured.lowrise,a=deriveEvidenceAssembly('lowrise',m,{alignmentTransform:{translation:[1,1,-2],yawRadians:-.9}}),s=deriveCaseContext(m,a,{inspectionContext:true}),shader=buildContextGLSL(s);assert.ok(shader.includes('p.y-('));assert.ok(shader.includes('p.x-('));assert.ok(!/--\d/.test(shader));
});

test('material directional derivatives share the winning local coordinate frame',()=>{
 for(const s of Object.values(contexts)){const local=[3,-.11,2],p=assemblyLocalToSource(s.assembly,local),h=queryContext(s,p),direction=unit([.3,.7,-.5]),world=rotate(s,direction);assert.equal(h.component,'assembly');vecClose(contextMaterialDirection(s,h,world),direction);const epsilon=.001,shifted=sourceToAssemblyLocal(s.assembly,add(p,mul(world,epsilon)));vecClose(add(h.local,mul(contextMaterialDirection(s,h,world),epsilon)),shifted);const sourceHit={objectId:1000};vecClose(contextMaterialDirection(s,sourceHit,world),world,0);assert.ok(buildContextGLSL(s).includes('vec3 contextMaterialDirection(FieldHit h,vec3 worldDirection)'));}
});

test('exact source/design ray coincidence keeps source identity without a full field re-query',()=>{
 const m=synthetic([{id:'coincident-slab-top',kind:'roofPlane',heightPlane:[0,0,0],loops:[[[-5,-5.5],[5,-5.5],[5,5.5],[-5,5.5]]]},{id:'context-height-bound',kind:'wallStrip',edge:[[100,0],[101,0]],bottom:0,top:5}]),a=deriveEvidenceAssembly('lowrise',m),s=deriveCaseContext(m,a,{inspectionContext:true}),h=intersectContextRay(s,[3,2,2],[0,-1,0],{display:false});assert.equal(h.hit,true);assert.equal(h.component,'source');assert.equal(h.objectId,1000);close(h.t,2);vecClose(h.local,[3,0,2]);const shader=buildContextGLSL(s);assert.ok(shader.includes('sourceT<=designT'));assert.ok(shader.includes('h=sourceWins?sourceHit:designHit'));
});
