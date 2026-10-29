import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const candidate=read('../whole-building-floor-study-r01/renderer.mjs');
const baseline=read('../whole-building-floor-study-r01/renderer.baseline-4722b220.mjs');
const section=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
test('frozen 4722 renderer remains exact',()=>assert.equal(createHash('sha256').update(baseline).digest('hex'),'2c980fb6e4e202e963b5419406f82b5709b58871c5a91f3343d9c52e598d1d9e'));
test('secondary ray generation and ping-pong trace paths unchanged',()=>{
 for(const [a,b]of [['function opticalRayShader(','const RAIL='],['    const pass=',' const trace=']]) assert.equal(section(candidate,a,b),section(baseline,a,b),a);
});
test('shader and renderer both gate primary-only aperture candidates',()=>{
 assert.ok(candidate.includes('floorPrimaryApertureRay=uRayMode==0'));
 assert.ok(candidate.includes("g.uniform1i(L('uPrimaryApertureIndexEnabled'),rayMode===0&&primaryApertureIndex?1:0)"));
 assert.ok(candidate.includes("g.uniform1i(L('uPrimaryApertureIndexRow'),rayMode===0?apertureTileRow("));
 assert.ok(candidate.includes('o.apertureTileIndex!==false'));
 assert.ok(candidate.includes("this.model.placementMode==='UNREGISTERED_evidence_plan_NOT_part_of_measured_mother'"));
});

test('assembly changes only broad-phase entry and physical clipping guard; analytic shape solver preserved',()=>{
 const guarded="void main(){previous();if(!rayActive())return;vec3 rd=rayDirection();for(int i=0;i<uInstanceCount;i++){floorPrimaryCandidateInstance=uRayMode==0?i:-1;vec3 origin=uInstances[i].xyz,ro=uEye-origin;float boundsLo,boundsHi,clipLo=0.,clipHi=outHit.x;if(!interval(uArchetypeMin,uArchetypeMax,ro,rd,outHit.x,boundsLo,boundsHi)||!clipInterval(uEye,rd,clipLo,clipHi))continue;float hi=min(boundsHi,clipHi);if(hi<max(boundsLo,clipLo))continue;float start=assemblyEntryStart(uArchetypeMin,uArchetypeMax,ro,rd,uEye,origin,boundsLo,clipLo);float t;FieldHit h;int visits;if(caseTraceRayBounded(ro+rd*start,rd,hi-start+8.*1.1920929e-7*(1.+abs(hi)+abs(start)),t,h,visits)&&t+start>=clipLo&&t+start<=hi){t+=start;h.objectId+=uInstances[i].w;accept(t,h,fieldRayNormal,uInstances[i].w);}}}",old="void main(){previous();if(!rayActive())return;vec3 rd=rayDirection();for(int i=0;i<uInstanceCount;i++){floorPrimaryCandidateInstance=uRayMode==0?i:-1;vec3 origin=uInstances[i].xyz,ro=uEye-origin;float lo,hi;if(!interval(uArchetypeMin,uArchetypeMax,ro,rd,outHit.x,lo,hi)||!clipInterval(uEye,rd,lo,hi))continue;float t;FieldHit h;int visits;if(caseTraceRayBounded(ro+rd*lo,rd,hi-lo+8.*1.1920929e-7*(1.+abs(hi)+abs(lo)),t,h,visits)&&t+lo<=hi){t+=lo;h.objectId+=uInstances[i].w;accept(t,h,fieldRayNormal,uInstances[i].w);}}}";
 const part=section(candidate,'function assemblyShader(','function apertureShader(');assert.ok(part.includes(guarded));assert.equal(part.replace('+ASSEMBLY_ENTRY_GUARD_GLSL','').replace(guarded,old),section(baseline,'function assemblyShader(','function apertureShader('));
});

test('rail pass is unchanged except the explicit unresolved-only rescue builder',()=>assert.equal(section(candidate,'const RAIL=','const SHADE=').replace('buildEvidenceStairRailGLSL()','buildStairRailGLSL()'),section(baseline,'const RAIL=','const SHADE=')));
