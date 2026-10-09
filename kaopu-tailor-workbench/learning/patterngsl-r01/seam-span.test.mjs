import assert from 'node:assert/strict';
import {test} from 'node:test';
import {auditSeamSpans,polylineGapBounds} from './seam-span.mjs';

function fixture() {
 const panels=['front','back'].map(id=>({id,uvMm:[[0,0],[5,0],[10,0],[0,10]],edges:{join:[0,1,2],open:[2,3,0]}}));
 const spec={schema:'kaopu-sewing-graph@1',units:'mm',panels,seams:[{id:'seam',stageId:'assembly',a:{panelId:'front',edge:'join',reverse:false},b:{panelId:'back',edge:'join',reverse:false},stitchVertexPairs:[[0,0],[2,2]],sourceSeam:{gathering:{ruffleCoefficientA:1,ruffleCoefficientB:1.3}}}]};
 const ps=[[0,0,0],[5,0,0],[10,0,0],[0,10,0],[0,0,0],[5,4,0],[10,0,0],[0,10,0]];
 return {spec,ps};
}
const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
function error(code,change) {const f=fixture();change(f);assert.throws(()=>auditSeamSpans(f.spec,f.ps),e=>e.code===code);}

test('zero needle gap does not hide a four-millimetre naked-boundary gap',()=>{
 const {spec,ps}=fixture(),before=JSON.stringify({spec,ps}),r=auditSeamSpans(spec,ps);
 near(r.maxNeedleGapMm,0);near(r.maxSpanLowerBoundMm,4);assert.ok(r.maxSpanUpperBoundMm>=4&&r.maxSpanUpperBoundMm<4.021);
 assert.deepEqual(r.separatedSeamIds,['seam']);assert.equal(r.garmentAccepted,false);assert.equal(r.allWithinReviewThreshold,false);
 assert.equal(r.unreferencedMaterialEdges,2);assert.equal(JSON.stringify({spec,ps}),before);
 assert.deepEqual(auditSeamSpans(spec,ps),r);
});
test('identical piecewise-linear paths need no artificial subdivisions',()=>{
 const a=[[0,0,0],[3,2,1],[10,0,0]],r=polylineGapBounds(a,a);
 near(r.lowerBoundMm,0);assert.ok(r.upperBoundMm<1e-8);assert.equal(r.resolved,true);
});
test('same straight path with different tessellation is bounded near zero',()=>{
 const r=polylineGapBounds([[0,0,0],[10,0,0]],[[0,0,0],[2,0,0],[7,0,0],[10,0,0]],{toleranceMm:.001});
 near(r.lowerBoundMm,0);assert.ok(r.upperBoundMm<=.001);assert.equal(r.resolved,true);
});
test('parallel separated paths return their exact gap',()=>{
 const r=polylineGapBounds([[0,0,0],[10,0,0]],[[0,3,0],[10,3,0]]);
 near(r.lowerBoundMm,3);near(r.upperBoundMm,3);assert.equal(r.resolved,true);
});
test('orientation must follow declared edge direction, even if geometric sets coincide',()=>{
 const {spec,ps}=fixture();spec.panels[1].edges.join.reverse();spec.seams[0].b.reverse=true;
 const r=auditSeamSpans(spec,ps);near(r.maxSpanLowerBoundMm,4);
 spec.seams[0].b.reverse=false;assert.throws(()=>auditSeamSpans(spec,ps),e=>e.code==='NEEDLE_ORDER');
});
test('invalid panel references are rejected, never repaired by proximity',()=>error('DANGLING_PANEL',({spec})=>spec.seams[0].b.panelId='unknown'));
test('invalid edge references are rejected',()=>error('DANGLING_EDGE',({spec})=>spec.seams[0].b.edge='unknown'));
test('duplicate panel IDs are rejected',()=>error('PANEL_ID',({spec})=>spec.panels[1].id=spec.panels[0].id));
test('duplicate seam IDs are rejected',()=>error('SEAM_ID',({spec})=>spec.seams.push(structuredClone(spec.seams[0]))));
test('one edge cannot silently sew to two other edges',()=>error('EDGE_USED_TWICE',({spec})=>spec.seams.push({...structuredClone(spec.seams[0]),id:'other'})));
test('needle sites must belong to the explicit source edges',()=>error('NEEDLE_OUTSIDE_REFERENCED_EDGE',({spec})=>spec.seams[0].stitchVertexPairs[0][0]=3));
test('interior sites alone do not complete seam endpoints',()=>error('UNPAIRED_SEAM_ENDPOINT',({spec})=>spec.seams[0].stitchVertexPairs[0]=[1,1]));
test('out of range material indices are rejected',()=>error('INVALID_EDGE_INDICES',({spec})=>spec.panels[0].edges.join[1]=99));
test('duplicate material vertices within one edge are rejected',()=>error('REPEATED_EDGE_VERTEX',({spec})=>spec.panels[0].edges.join[1]=0));
test('zero-length original material segments are rejected',()=>error('ZERO_MATERIAL_EDGE',({spec})=>spec.panels[0].uvMm[1]=[0,0]));
test('NaN positions are rejected',()=>error('INVALID_POSITIONS',({ps})=>ps[0][0]=NaN));
test('source units are never silently guessed',()=>error('SCHEMA_UNITS',({spec})=>spec.units='cm'));
test('invalid declared gathering does not fall back to a ratio threshold',()=>error('INVALID_GATHERING',({spec})=>spec.seams[0].sourceSeam.gathering.ruffleCoefficientA=0));
test('small declared gathering is still identified, without an obsolete fifteen-percent threshold',()=>{
 const {spec,ps}=fixture();spec.seams[0].sourceSeam.gathering.ruffleCoefficientB=1.05;
 assert.equal(auditSeamSpans(spec,ps).rows[0].declaredGathering,true);
});
test('unknown gathering is not falsely labelled absent',()=>{
 const {spec,ps}=fixture();delete spec.seams[0].sourceSeam;
 assert.equal(auditSeamSpans(spec,ps).rows[0].declaredGathering,null);
});
test('unsewn / deliberately open edges are not automatically bad seams',()=>{
 const {spec,ps}=fixture();const r=auditSeamSpans(spec,ps,{activeSeamIds:[]});
 assert.equal(r.measuredSeams,0);assert.equal(r.allWithinReviewThreshold,false);
 assert.throws(()=>auditSeamSpans(spec,ps,{activeSeamIds:['missing']}),e=>e.code==='UNKNOWN_ACTIVE_SEAM');
});
test('an insufficient refinement budget stays unresolved, not silently passed',()=>{
 const a=[[0,0,0],[10,0,0]],b=[[0,0,0],[5,0,0],[10,0,0]];
 const r=polylineGapBounds(a,b,{toleranceMm:.0001,maxEvaluations:5});
 assert.equal(r.resolved,false);assert.ok(r.errorBoundMm>.0001);assert.equal(r.evaluations,5);
});
test('coincident deformed segments remain measurable without modifying rest geometry',()=>{
 const {spec,ps}=fixture();for(let i=0;i<ps.length;i++)ps[i]=[0,0,0];const r=auditSeamSpans(spec,ps);
 near(r.maxSpanLowerBoundMm,0);assert.equal(r.allWithinReviewThreshold,true);assert.equal(r.garmentAccepted,false);
});
test('dart tip shared by both material edges is permitted',()=>{
 const spec={schema:'kaopu-sewing-graph@1',units:'mm',panels:[{id:'dart',uvMm:[[0,0],[5,5],[10,0]],edges:{a:[0,1],b:[1,2]}}],seams:[{id:'dart-seam',a:{panelId:'dart',edge:'a'},b:{panelId:'dart',edge:'b',reverse:true},stitchVertexPairs:[[0,2],[1,1]]}]};
 const r=auditSeamSpans(spec,[[0,0,0],[5,5,0],[0,0,0]]);near(r.maxNeedleGapMm,0);near(r.maxSpanLowerBoundMm,0);
});

// Independent dense sampling comparison: not reused by the bounds implementation.
function pointSegment(p,a,b){let dot=0,len=0;for(let k=0;k<3;k++){dot+=(p[k]-a[k])*(b[k]-a[k]);len+=(b[k]-a[k])**2;}const t=len?Math.max(0,Math.min(1,dot/len)):0;return Math.sqrt(p.reduce((sum,v,k)=>sum+(v-a[k]-t*(b[k]-a[k]))**2,0));}
function denseGap(a,b){let maximum=0;for(const[s,t]of[[a,b],[b,a]])for(let i=1;i<s.length;i++)for(let j=0;j<=256;j++){const p=s[i].map((v,k)=>s[i-1][k]+j/256*(v-s[i-1][k]));let d=Infinity;for(let k=1;k<t.length;k++)d=Math.min(d,pointSegment(p,t[k-1],t[k]));maximum=Math.max(maximum,d);}return maximum;}
test('upper bounds contain independently sampled distances on eighty deterministic random path pairs',()=>{
 let seed=0x2738495;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return(seed/2**32-.5)*20;};
 let interiorPeakCases=0;
 for(let trial=0;trial<80;trial++){
  const a=Array.from({length:4},()=>[rnd(),rnd(),rnd()]),b=Array.from({length:5},()=>[rnd(),rnd(),rnd()]);
  const r=polylineGapBounds(a,b,{toleranceMm:.001}),dense=denseGap(a,b);
  assert.ok(dense<=r.upperBoundMm+1e-8,`${dense} > ${r.upperBoundMm}`);assert.ok(r.resolved);assert.ok(r.errorBoundMm<=.001);
  let vm=0;for(const[s,t]of[[a,b],[b,a]])for(const p of s)vm=Math.max(vm,Math.min(...t.slice(1).map((v,k)=>pointSegment(p,t[k],v))));
  if(r.lowerBoundMm>vm+.001)interiorPeakCases++;
 }
 assert.ok(interiorPeakCases>0,'fixtures must include maxima between the original vertices');
});
test('translation preserves the measured geometry gap',()=>{
 const a=[[0,0,0],[5,0,0],[10,0,0]],b=[[0,0,0],[5,4,0],[10,0,0]],move=p=>p.map((v,k)=>v+[1e6,-2e5,1345][k]);
 const x=polylineGapBounds(a,b),y=polylineGapBounds(a.map(move),b.map(move));near(x.lowerBoundMm,y.lowerBoundMm,1e-6);
});
